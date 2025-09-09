"""
ChromaDB 服务模块
负责向量数据库的操作
"""
import asyncio
from typing import List, Optional, Dict, Any
import chromadb
from chromadb.api.models.AsyncCollection import AsyncCollection
from loguru import logger


class ChromaDBService:
    """ChromaDB 服务类"""
    
    def __init__(self, host: str = "localhost", port: int = 18000):
        """
        初始化 ChromaDB 服务
        
        Args:
            host: ChromaDB 服务器地址
            port: ChromaDB 服务器端口
        """
        self.host = host
        self.port = port
        self._client = None
        self._collections_cache: Dict[str, AsyncCollection] = {}
        self._lock = asyncio.Lock()
    
    async def _get_client(self):
        """获取或创建 ChromaDB 客户端"""
        if self._client is None:
            async with self._lock:
                if self._client is None:
                    try:
                        self._client = await chromadb.AsyncHttpClient(
                            host=self.host, 
                            port=self.port
                        )
                        logger.info(f"已连接到 ChromaDB: {self.host}:{self.port}")
                    except Exception as e:
                        logger.error(f"连接 ChromaDB 失败: {e}")
                        raise
        return self._client
    
    async def get_or_create_collection(self, name: str) -> AsyncCollection:
        """
        获取或创建集合
        
        Args:
            name: 集合名称
            
        Returns:
            异步集合对象
        """
        if name not in self._collections_cache:
            client = await self._get_client()
            try:
                collection = await client.get_or_create_collection(name=name)
                self._collections_cache[name] = collection
                logger.info(f"获取/创建集合成功: {name}")
            except Exception as e:
                logger.error(f"获取/创建集合失败 {name}: {e}")
                raise
        
        return self._collections_cache[name]
    
    async def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        ids: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        添加文档到集合
        
        Args:
            collection_name: 集合名称
            documents: 文档内容列表
            ids: 文档ID列表
            embeddings: 嵌入向量列表
            metadatas: 元数据列表
            
        Returns:
            是否成功
        """
        try:
            collection = await self.get_or_create_collection(collection_name)
            
            await collection.add(
                documents=documents,
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas
            )
            
            logger.info(f"成功添加 {len(documents)} 个文档到集合 {collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"添加文档失败: {e}")
            raise
    
    async def query_documents(
        self,
        collection_name: str,
        query_embeddings: Optional[List[List[float]]] = None,
        query_texts: Optional[List[str]] = None,
        n_results: int = 5,
        include: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        查询文档
        
        Args:
            collection_name: 集合名称
            query_embeddings: 查询向量
            query_texts: 查询文本
            n_results: 返回结果数量
            include: 包含的字段
            
        Returns:
            查询结果
        """
        try:
            collection = await self.get_or_create_collection(collection_name)
            
            # 设置默认包含字段
            if include is None:
                include = ["documents", "distances", "metadatas"]
            
            results = await collection.query(
                query_embeddings=query_embeddings,
                query_texts=query_texts,
                n_results=n_results,
                include=include
            )
            
            # 安全地计算返回的结果数量
            result_count = 0
            if results and results.get('ids') and len(results['ids']) > 0:
                result_count = len(results['ids'][0])
            
            logger.info(f"查询集合 {collection_name} 完成，返回 {result_count} 个结果")
            return results
            
        except Exception as e:
            logger.error(f"查询文档失败: {e}")
            raise
    
    async def upsert_documents(
        self,
        collection_name: str,
        documents: List[str],
        ids: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        更新或插入文档到集合（upsert操作）
        
        Args:
            collection_name: 集合名称
            documents: 文档内容列表
            ids: 文档ID列表
            embeddings: 嵌入向量列表
            metadatas: 元数据列表
            
        Returns:
            是否成功
        """
        try:
            collection = await self.get_or_create_collection(collection_name)
            
            await collection.upsert(
                documents=documents,
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas
            )
            
            logger.info(f"成功upsert {len(documents)} 个文档到集合 {collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"Upsert文档失败: {e}")
            raise

    async def delete_documents(
        self,
        collection_name: str,
        ids: List[str]
    ) -> bool:
        """
        删除文档
        
        Args:
            collection_name: 集合名称
            ids: 要删除的文档ID列表
            
        Returns:
            是否成功
        """
        try:
            collection = await self.get_or_create_collection(collection_name)
            
            await collection.delete(ids=ids)
            
            logger.info(f"成功从集合 {collection_name} 删除 {len(ids)} 个文档")
            return True
            
        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            raise
    
    async def get_collection_info(self, collection_name: str) -> Dict[str, Any]:
        """
        获取集合信息
        
        Args:
            collection_name: 集合名称
            
        Returns:
            集合信息
        """
        try:
            collection = await self.get_or_create_collection(collection_name)
            count = await collection.count()
            
            return {
                "name": collection_name,
                "count": count
            }
            
        except Exception as e:
            logger.error(f"获取集合信息失败: {e}")
            raise
    
    async def list_collections(self) -> List[str]:
        """
        列出所有集合
        
        Returns:
            集合名称列表
        """
        try:
            client = await self._get_client()
            collections = await client.list_collections()
            return [col.name for col in collections]
            
        except Exception as e:
            logger.error(f"列出集合失败: {e}")
            raise
    
    async def ping(self) -> bool:
        """
        检查连接状态
        
        Returns:
            是否连接正常
        """
        try:
            client = await self._get_client()
            await client.heartbeat()
            return True
        except Exception as e:
            logger.error(f"ChromaDB 连接检查失败: {e}")
            return False
    
    async def clear_collection(self, collection_name: str) -> bool:
        """
        清空集合中的所有文档
        
        Args:
            collection_name: 集合名称
            
        Returns:
            是否成功
        """
        try:
            client = await self._get_client()
            
            # 检查集合是否存在
            try:
                collection = await client.get_collection(collection_name)
                
                # 获取所有文档ID
                result = await collection.get()
                if result and result.get("ids"):
                    # 删除所有文档
                    await collection.delete(ids=result["ids"])
                    logger.info(f"已清空集合 {collection_name}，删除了 {len(result['ids'])} 个文档")
                else:
                    logger.info(f"集合 {collection_name} 已经是空的")
                
                # 从缓存中移除
                if collection_name in self._collections_cache:
                    del self._collections_cache[collection_name]
                
                return True
                
            except Exception as e:
                if "does not exist" in str(e).lower():
                    logger.info(f"集合 {collection_name} 不存在，无需清空")
                    return True
                else:
                    raise
                
        except Exception as e:
            logger.error(f"清空集合失败: {e}")
            return False


# 全局 ChromaDB 服务实例
chroma_service = ChromaDBService()
