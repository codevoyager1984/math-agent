"""
Elasticsearch 服务模块
提供文档索引、搜索和管理功能，支持全文检索
"""
import asyncio
import json
import uuid
import time
from typing import List, Dict, Any, Optional, Tuple
from elasticsearch import AsyncElasticsearch
from elasticsearch.exceptions import ConnectionError, NotFoundError
from loguru import logger

from config import settings
from schemas.embeddings import DocumentInput


class ElasticsearchService:
    """Elasticsearch 服务类"""

    def __init__(self):
        """初始化 Elasticsearch 服务"""
        self.host = settings.ELASTICSEARCH_HOST
        self.port = settings.ELASTICSEARCH_PORT
        self.index = settings.ELASTICSEARCH_INDEX
        self.es_client = None

        logger.info(f"Elasticsearch service initialized - host: {self.host}, port: {self.port}, index: {self.index}")

    def _get_es_client(self):
        """获取 Elasticsearch 客户端，延迟初始化"""
        if self.es_client is None:
            # 构建连接配置
            es_config = {
                "hosts": [f"http://{self.host}:{self.port}"],
                "timeout": 30,
                "max_retries": 3,
                "retry_on_timeout": True
            }

            # 添加认证信息
            if settings.ELASTICSEARCH_USERNAME and settings.ELASTICSEARCH_PASSWORD:
                es_config["basic_auth"] = (
                    settings.ELASTICSEARCH_USERNAME,
                    settings.ELASTICSEARCH_PASSWORD
                )

            self.es_client = AsyncElasticsearch(**es_config)
            logger.info(f"Elasticsearch client created for {self.host}:{self.port}")

        return self.es_client

    async def initialize_index(self) -> bool:
        """
        初始化索引，创建知识点文档的映射

        Returns:
            是否成功
        """
        request_id = str(uuid.uuid4())[:8]
        logger.info(f"[{request_id}] Initializing Elasticsearch index: {self.index}")

        try:
            es_client = self._get_es_client()

            # 检查索引是否存在
            exists = await es_client.indices.exists(index=self.index)
            if exists:
                logger.info(f"[{request_id}] Index {self.index} already exists")
                return True

            # 创建索引映射
            mapping = {
                "mappings": {
                    "properties": {
                        "id": {"type": "keyword"},
                        "title": {
                            "type": "text",
                            "analyzer": "standard",
                            "fields": {
                                "keyword": {"type": "keyword"}
                            }
                        },
                        "description": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "category": {"type": "keyword"},
                        "content": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "examples": {
                            "type": "nested",
                            "properties": {
                                "question": {"type": "text", "analyzer": "standard"},
                                "solution": {"type": "text", "analyzer": "standard"},
                                "difficulty": {"type": "keyword"}
                            }
                        },
                        "tags": {"type": "keyword"},
                        "examples_count": {"type": "integer"},
                        "created_at": {"type": "date"},
                        "updated_at": {"type": "date"}
                    }
                },
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                    "analysis": {
                        "analyzer": {
                            "standard": {
                                "type": "standard"
                            }
                        }
                    }
                }
            }

            # 创建索引
            response = await es_client.indices.create(
                index=self.index,
                body=mapping
            )

            logger.info(f"[{request_id}] Successfully created index: {self.index}")
            return True

        except Exception as e:
            logger.error(f"[{request_id}] Failed to initialize index {self.index}: {e}")
            return False

    async def add_documents(
        self,
        documents: List[DocumentInput],
        request_id: Optional[str] = None
    ) -> bool:
        """
        添加文档到 Elasticsearch

        Args:
            documents: 文档列表
            request_id: 请求ID用于追踪

        Returns:
            是否成功
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        start_time = time.time()
        logger.info(f"[{request_id}] Starting Elasticsearch indexing for {len(documents)} documents")

        try:
            es_client = self._get_es_client()

            # 确保索引存在
            await self.initialize_index()

            # 构建批量操作
            actions = []
            for doc in documents:
                # 解析元数据
                metadata = doc.metadata or {}

                # 解析 JSON 字段
                examples_data = []
                if "examples" in metadata:
                    try:
                        examples_data = json.loads(metadata["examples"])
                    except (json.JSONDecodeError, TypeError):
                        examples_data = []

                tags_data = []
                if "tags" in metadata:
                    try:
                        tags_data = json.loads(metadata["tags"])
                    except (json.JSONDecodeError, TypeError):
                        tags_data = []

                # 构建文档数据
                es_doc = {
                    "id": doc.id,
                    "title": metadata.get("title", ""),
                    "description": metadata.get("description", ""),
                    "category": metadata.get("category", "general"),
                    "content": doc.content,
                    "examples": examples_data,
                    "tags": tags_data,
                    "examples_count": len(examples_data),
                    "created_at": metadata.get("created_at"),
                    "updated_at": metadata.get("updated_at")
                }

                # 添加到批量操作
                actions.extend([
                    {"index": {"_index": self.index, "_id": doc.id}},
                    es_doc
                ])

            # 执行批量索引
            index_start = time.time()
            response = await es_client.bulk(body=actions)
            index_time = time.time() - index_start

            # 检查错误
            errors = []
            if response.get("errors"):
                for item in response.get("items", []):
                    if "index" in item and "error" in item["index"]:
                        errors.append(item["index"]["error"])

            total_time = time.time() - start_time

            if errors:
                logger.warning(f"[{request_id}] Elasticsearch indexing completed with errors in {total_time:.3f}s")
                logger.warning(f"[{request_id}] Errors: {errors}")
                return False
            else:
                logger.info(f"[{request_id}] Elasticsearch indexing completed successfully in {total_time:.3f}s")
                logger.info(f"[{request_id}] Index operation took {index_time:.3f}s")
                return True

        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[{request_id}] Elasticsearch indexing failed after {total_time:.3f}s: {e}")
            return False

    async def search_documents(
        self,
        query: str,
        size: int = 10,
        request_id: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        搜索文档

        Args:
            query: 搜索查询
            size: 返回结果数量
            request_id: 请求ID用于追踪

        Returns:
            搜索结果列表和搜索用时
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        start_time = time.time()
        logger.info(f"[{request_id}] Starting Elasticsearch search: '{query[:50]}...'")

        try:
            es_client = self._get_es_client()

            # 构建搜索查询
            search_body = {
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": [
                            "title^3",
                            "description^2",
                            "content",
                            "examples.question^2",
                            "examples.solution",
                            "tags^1.5"
                        ],
                        "type": "best_fields",
                        "fuzziness": "AUTO"
                    }
                },
                "size": size,
                "_source": {
                    "excludes": ["content"]  # 排除大字段以提高性能
                },
                "highlight": {
                    "fields": {
                        "title": {},
                        "description": {},
                        "examples.question": {},
                        "examples.solution": {}
                    }
                }
            }

            # 执行搜索
            search_start = time.time()
            response = await es_client.search(
                index=self.index,
                body=search_body
            )
            search_time = time.time() - search_start

            # 解析结果
            results = []
            hits = response.get("hits", {}).get("hits", [])

            for hit in hits:
                source = hit["_source"]
                result = {
                    "id": source.get("id"),
                    "title": source.get("title"),
                    "description": source.get("description"),
                    "category": source.get("category"),
                    "examples": source.get("examples", []),
                    "tags": source.get("tags", []),
                    "created_at": source.get("created_at"),
                    "updated_at": source.get("updated_at"),
                    "es_score": hit["_score"],
                    "highlight": hit.get("highlight", {})
                }
                results.append(result)

            total_time = time.time() - start_time
            logger.info(f"[{request_id}] Elasticsearch search completed in {total_time:.3f}s")
            logger.info(f"[{request_id}] Found {len(results)} results, search took {search_time:.3f}s")

            return results, search_time

        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[{request_id}] Elasticsearch search failed after {total_time:.3f}s: {e}")
            return [], 0.0

    async def delete_documents(
        self,
        ids: List[str],
        request_id: Optional[str] = None
    ) -> bool:
        """
        删除文档

        Args:
            ids: 文档ID列表
            request_id: 请求ID用于追踪

        Returns:
            是否成功
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        logger.info(f"[{request_id}] Deleting {len(ids)} documents from Elasticsearch")

        try:
            es_client = self._get_es_client()

            # 构建批量删除操作
            actions = []
            for doc_id in ids:
                actions.append({"delete": {"_index": self.index, "_id": doc_id}})

            # 执行批量删除
            response = await es_client.bulk(body=actions)

            # 检查错误
            if response.get("errors"):
                logger.warning(f"[{request_id}] Some documents failed to delete")
                return False

            logger.info(f"[{request_id}] Successfully deleted {len(ids)} documents")
            return True

        except Exception as e:
            logger.error(f"[{request_id}] Failed to delete documents: {e}")
            return False

    async def clear_index(self, request_id: Optional[str] = None) -> bool:
        """
        清空索引

        Args:
            request_id: 请求ID用于追踪

        Returns:
            是否成功
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        logger.info(f"[{request_id}] Clearing Elasticsearch index: {self.index}")

        try:
            es_client = self._get_es_client()

            # 删除所有文档
            response = await es_client.delete_by_query(
                index=self.index,
                body={"query": {"match_all": {}}}
            )

            deleted_count = response.get("deleted", 0)
            logger.info(f"[{request_id}] Cleared {deleted_count} documents from index")
            return True

        except Exception as e:
            logger.error(f"[{request_id}] Failed to clear index: {e}")
            return False

    async def ping(self) -> bool:
        """
        检查 Elasticsearch 连接

        Returns:
            是否连接正常
        """
        try:
            es_client = self._get_es_client()
            response = await es_client.ping()
            return response
        except Exception as e:
            logger.error(f"Elasticsearch ping failed: {e}")
            return False

    async def get_index_info(self) -> Dict[str, Any]:
        """
        获取索引信息

        Returns:
            索引统计信息
        """
        try:
            es_client = self._get_es_client()
            stats = await es_client.indices.stats(index=self.index)
            indices_info = stats.get("indices", {})
            index_info = indices_info.get(self.index, {})

            return {
                "index_name": self.index,
                "document_count": index_info.get("total", {}).get("docs", {}).get("count", 0),
                "store_size": index_info.get("total", {}).get("store", {}).get("size_in_bytes", 0),
                "status": "healthy"
            }

        except Exception as e:
            logger.error(f"Failed to get index info: {e}")
            return {
                "index_name": self.index,
                "status": "unhealthy",
                "error": str(e)
            }

    async def close(self):
        """关闭连接"""
        try:
            if self.es_client is not None:
                await self.es_client.close()
                self.es_client = None
        except Exception as e:
            logger.error(f"Failed to close Elasticsearch connection: {e}")


# 全局 Elasticsearch 服务实例
elasticsearch_service = ElasticsearchService()