"""
RAG 主服务模块
整合嵌入向量服务、ChromaDB 服务、Elasticsearch 服务和重排序服务，提供高层次的 RAG 功能
"""
import math
import time
import uuid
from typing import List, Dict, Any, Optional

from .embedding_service import embedding_service
from .chroma_service import chroma_service
from .elasticsearch_service import elasticsearch_service
from .rerank_service import rerank_service
from .llm_rerank_service import llm_rerank_service
from schemas.embeddings import (
    DocumentInput, DocumentResult, QueryResponse, QueryRequest,
    HybridQueryRequest, HybridQueryResponse, RankedDocumentResult
)
from loguru import logger
import asyncio

class RAGService:
    """RAG 主服务类"""
    
    def __init__(self):
        """初始化 RAG 服务"""
        self.embedding_service = embedding_service
        self.chroma_service = chroma_service
        self.elasticsearch_service = elasticsearch_service
        self.rerank_service = rerank_service
        self.llm_rerank_service = llm_rerank_service
        self.collection_name = "math_knowledge"
    
    def _calculate_similarity_score(self, result: Dict[str, Any], search_mode: str) -> float:
        """
        统一计算相似度分数 (0-100 范围)
        
        Args:
            result: 包含各种分数的结果字典
            search_mode: 搜索模式 ('vector', 'text', 'hybrid')
            
        Returns:
            统一的相似度分数 (0-100)
        """
        # 1. 如果有重排序分数，优先使用（已经是最优化的分数）
        if result.get("rerank_score") is not None:
            rerank_score = result["rerank_score"]
            
            # 检查是否是 LLM 重排序的分数（已经是 0-100 范围）
            if result.get("rerank_method") == "llm" or result.get("llm_similarity_score") is not None:
                # LLM 重排序已经返回 0-100 范围的分数，直接使用
                return max(0, min(100, rerank_score))
            else:
                # Cross-encoder 重排序分数范围通常是 -∞ 到 +∞
                # 正分数表示相关，负分数表示不相关
                # 使用 sigmoid 函数将分数映射到 0-100 范围
                
                # 使用调整后的 sigmoid 函数进行缩放
                # 将分数向下偏移，让低相关性的查询得到更低的分数
                threshold = 5.0  # 阈值，低于此值的分数会被显著压缩
                scale = 1.0      # 缩放因子，控制变化陡峭程度
                adjusted_score = (rerank_score - threshold) * scale
                sigmoid_score = 1.0 / (1.0 + math.exp(-adjusted_score))
                similarity = sigmoid_score * 100
                
                return max(0, min(100, similarity))
        
        # 2. 如果有final_score，使用它
        if result.get("final_score") is not None:
            final_score = result["final_score"]
            
            # final_score 通常来自 rerank_score，使用相同的调整后 sigmoid 转换
            if final_score > 1:  # 可能是重排序分数
                threshold = 5.0
                scale = 1.0
                adjusted_score = (final_score - threshold) * scale
                sigmoid_score = 1.0 / (1.0 + math.exp(-adjusted_score))
                similarity = sigmoid_score * 100
            else:  # 可能是 0-1 范围的分数
                similarity = final_score * 100
                
            return max(0, min(100, similarity))
        
        # 3. 根据搜索模式选择合适的分数
        if search_mode == 'hybrid' and result.get("fusion_score") is not None:
            # 混合搜索模式：使用融合分数 (通常0-1范围)
            return max(0, min(100, result["fusion_score"] * 100))
        
        if search_mode == 'text' and result.get("text_score") is not None:
            # 文本搜索模式：使用文本分数 (通常0-1范围)
            return max(0, min(100, result["text_score"] * 100))
        
        if search_mode == 'vector' and result.get("vector_score") is not None:
            # 向量搜索模式：使用向量分数 (通常0-1范围)
            return max(0, min(100, result["vector_score"] * 100))
        
        # 4. 回退到可用的分数
        if result.get("fusion_score") is not None:
            return max(0, min(100, result["fusion_score"] * 100))
        
        if result.get("vector_score") is not None and result["vector_score"] > 0:
            return max(0, min(100, result["vector_score"] * 100))
        
        if result.get("text_score") is not None and result["text_score"] > 0:
            return max(0, min(100, result["text_score"] * 100))
        
        # 5. 最后使用距离转换（改进的转换公式）
        if result.get("distance") is not None:
            # ChromaDB L2距离转换为相似度分数
            distance = abs(result["distance"])
            if distance == 0:
                return 100
            if distance == float('inf'):
                return 0
            
            # 使用高斯衰减，sigma参数控制衰减速度
            sigma = 1.5  # 可根据实际效果调整
            similarity = math.exp(-(distance * distance) / (2 * sigma * sigma))
            return max(0, min(100, similarity * 100))
        
        return 0
    
    async def add_documents(
        self,
        documents: List[DocumentInput],
        request_id: Optional[str] = None
    ) -> bool:
        """
        添加文档到知识库（双写到 ChromaDB 和 Elasticsearch）

        Args:
            documents: 文档列表
            request_id: 请求ID用于追踪

        Returns:
            是否成功
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        try:
            # 提取文档内容和元数据
            contents = [doc.content for doc in documents]
            ids = [doc.id for doc in documents]
            metadatas = [doc.metadata for doc in documents if doc.metadata]

            # 如果没有元数据，设置为 None
            if not metadatas or len(metadatas) != len(documents):
                metadatas = None

            # 生成嵌入向量
            logger.info(f"[{request_id}] 正在为 {len(documents)} 个文档生成嵌入向量...")
            embeddings = await self.embedding_service.encode_batch(contents)

            # 并行存储到 ChromaDB 和 Elasticsearch
            logger.info(f"[{request_id}] 正在并行存储文档到 ChromaDB 和 Elasticsearch...")

            chroma_task = self.chroma_service.add_documents(
                collection_name=self.collection_name,
                documents=contents,
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas
            )

            es_task = self.elasticsearch_service.add_documents(
                documents=documents,
                request_id=request_id
            )

            # 等待两个存储操作完成
            chroma_success, es_success = await asyncio.gather(
                chroma_task, es_task, return_exceptions=True
            )

            # 检查结果
            if isinstance(chroma_success, Exception):
                logger.error(f"[{request_id}] ChromaDB 存储失败: {chroma_success}")
                chroma_success = False

            if isinstance(es_success, Exception):
                logger.error(f"[{request_id}] Elasticsearch 存储失败: {es_success}")
                es_success = False

            # 如果任一存储失败，尝试回滚
            if not chroma_success or not es_success:
                logger.warning(f"[{request_id}] 存储失败，尝试回滚操作...")
                if chroma_success and not es_success:
                    # ChromaDB 成功但 ES 失败，删除 ChromaDB 中的文档
                    await self.chroma_service.delete_documents(
                        collection_name=self.collection_name,
                        ids=ids
                    )
                elif es_success and not chroma_success:
                    # ES 成功但 ChromaDB 失败，删除 ES 中的文档
                    await self.elasticsearch_service.delete_documents(
                        ids=ids,
                        request_id=request_id
                    )
                return False

            logger.info(f"[{request_id}] 成功添加 {len(documents)} 个文档到双重存储系统")
            return True

        except Exception as e:
            logger.error(f"[{request_id}] 添加文档到知识库失败: {e}")
            raise
    
    async def query_documents(
        self,
        query: str,
        n_results: int = 5,
        include_metadata: bool = True
    ) -> QueryResponse:
        """
        查询相关文档
        
        Args:
            query: 查询文本
            collection_name: 集合名称
            n_results: 返回结果数量
            include_metadata: 是否包含元数据
            
        Returns:
            查询响应
        """
        try:
            query = query.strip() if query else ""
            # 生成查询向量
            logger.info(f"正在为查询生成嵌入向量: {query[:50]}...")
            query_embedding = await self.embedding_service.encode(query)
            
            # 设置包含字段
            include = ["documents", "distances", "metadatas"] if include_metadata else ["documents", "distances"]
            
            # 查询 ChromaDB
            logger.info(f"正在查询集合 {self.collection_name}...")
            results = await self.chroma_service.query_documents(
                collection_name=self.collection_name,
                query_embeddings=[query_embedding],
                n_results=n_results,
                include=include
            )
            
            # 解析结果
            document_results = []
            if (results and "ids" in results and results["ids"] and 
                len(results["ids"]) > 0 and len(results["ids"][0]) > 0):
                
                ids = results["ids"][0]  # 第一个查询的结果
                documents = results.get("documents", [[]])[0] if results.get("documents") else []
                distances = results.get("distances", [[]])[0] if results.get("distances") else []
                metadatas = results.get("metadatas", [[]])[0] if (include_metadata and results.get("metadatas")) else [None] * len(ids)
                
                for i, doc_id in enumerate(ids):
                    # 创建临时结果字典用于计算相似度分数
                    temp_result = {
                        "distance": distances[i] if i < len(distances) else 0.0,
                    }
                    similarity_score = self._calculate_similarity_score(temp_result, "vector")
                    
                    document_result = DocumentResult(
                        id=doc_id,
                        content=documents[i] if i < len(documents) else "",
                        distance=distances[i] if i < len(distances) else 0.0,
                        metadata=metadatas[i] if i < len(metadatas) else None,
                        similarity_score=similarity_score
                    )
                    document_results.append(document_result)
            
            response = QueryResponse(
                results=document_results,
                query=query,
                total_results=len(document_results)
            )
            
            logger.info(f"查询完成，返回 {len(document_results)} 个结果")
            return response
            
        except Exception as e:
            logger.error(f"查询文档失败: {e}")
            raise

    async def hybrid_query_documents(
        self,
        request: HybridQueryRequest,
        request_id: Optional[str] = None
    ) -> HybridQueryResponse:
        """
        混合搜索文档（结合向量搜索、全文搜索和重排序）

        Args:
            request: 混合搜索请求
            request_id: 请求ID用于追踪

        Returns:
            混合搜索响应
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        start_time = time.time()
        timing = {}
        search_stats = {}

        logger.info(f"[{request_id}] Starting hybrid search: '{request.query[:50]}...'")
        logger.info(f"[{request_id}] Search mode: {request.search_mode}, n_results: {request.n_results}")

        try:
            vector_results = []
            text_results = []

            # 向量搜索
            if request.search_mode in ["vector", "hybrid"]:
                vector_start = time.time()
                logger.info(f"[{request_id}] Performing vector search...")

                vector_response = await self.query_documents(
                    query=request.query,
                    n_results=request.n_results * 2,  # 获取更多候选
                    include_metadata=True
                )

                # 转换向量搜索结果格式
                for result in vector_response.results:
                    if result.metadata:
                        vector_results.append({
                            "id": result.id,
                            "title": result.metadata.get("title"),
                            "description": result.metadata.get("description"),
                            "category": result.metadata.get("category"),
                            "examples": self._parse_json_field(result.metadata.get("examples", "[]")),
                            "tags": self._parse_json_field(result.metadata.get("tags", "[]")),
                            "created_at": result.metadata.get("created_at"),
                            "updated_at": result.metadata.get("updated_at"),
                            "distance": result.distance,
                            "source": "vector"
                        })

                timing["vector_search"] = time.time() - vector_start
                search_stats["vector_results"] = len(vector_results)
                logger.info(f"[{request_id}] Vector search completed in {timing['vector_search']:.3f}s, found {len(vector_results)} results")

            # 文本搜索
            if request.search_mode in ["text", "hybrid"]:
                text_start = time.time()
                logger.info(f"[{request_id}] Performing text search...")

                text_results, text_search_time = await self.elasticsearch_service.search_documents(
                    query=request.query,
                    size=request.n_results * 2,  # 获取更多候选
                    request_id=request_id
                )

                for result in text_results:
                    result["source"] = "text"

                timing["text_search"] = time.time() - text_start
                search_stats["text_results"] = len(text_results)
                logger.info(f"[{request_id}] Text search completed in {timing['text_search']:.3f}s, found {len(text_results)} results")

            # 结果融合
            if request.search_mode == "hybrid" and vector_results and text_results:
                fusion_start = time.time()
                logger.info(f"[{request_id}] Fusing vector and text results...")

                # 使用重排序服务进行结果融合
                fused_results = await self.rerank_service.hybrid_score_fusion(
                    vector_results=vector_results,
                    text_results=text_results,
                    vector_weight=request.vector_weight,
                    text_weight=request.text_weight,
                    request_id=request_id
                )

                timing["fusion"] = time.time() - fusion_start
                search_stats["fused_results"] = len(fused_results)
                logger.info(f"[{request_id}] Result fusion completed in {timing['fusion']:.3f}s")

            elif request.search_mode == "vector":
                fused_results = vector_results
            elif request.search_mode == "text":
                fused_results = text_results
            else:
                fused_results = []

            # 重排序
            final_results = fused_results
            if request.enable_rerank and fused_results:
                rerank_start = time.time()
                rerank_method = getattr(request, 'rerank_method', 'cross_encoder')
                logger.info(f"[{request_id}] Starting reranking of {len(fused_results)} results using {rerank_method}...")

                if rerank_method == 'llm':
                    # 使用大模型重排序
                    reranked_results = await self.llm_rerank_service.rerank_documents(
                        query=request.query,
                        candidates=fused_results,
                        top_k=request.rerank_top_k or request.n_results,
                        request_id=request_id
                    )
                    
                    # LLM rerank 已经设置了 rerank_score，直接使用
                    for result in reranked_results:
                        result["final_score"] = result.get("rerank_score", result.get("fusion_score", 0.0))
                        
                else:
                    # 使用传统的 cross-encoder 重排序
                    reranked_results = await self.rerank_service.rerank_results(
                        query=request.query,
                        candidates=fused_results,
                        top_k=request.rerank_top_k or request.n_results,
                        request_id=request_id
                    )
                    
                    # 设置最终分数
                    for result in reranked_results:
                        result["final_score"] = result.get("rerank_score", result.get("fusion_score", 0.0))

                final_results = reranked_results
                timing["rerank"] = time.time() - rerank_start
                search_stats["reranked_results"] = len(final_results)
                search_stats["rerank_method"] = rerank_method
                logger.info(f"[{request_id}] Reranking completed in {timing['rerank']:.3f}s using {rerank_method}")

            else:
                # 设置最终分数（不重排序时）
                for result in final_results:
                    result["final_score"] = result.get("fusion_score", result.get("distance", 0.0))

            # 限制结果数量
            final_results = final_results[:request.n_results]

            # 转换为响应格式
            response_results = []
            for result in final_results:
                # 计算统一的相似度分数
                similarity_score = self._calculate_similarity_score(result, request.search_mode)
                
                ranked_result = RankedDocumentResult(
                    id=result["id"],
                    title=result.get("title"),
                    description=result.get("description"),
                    category=result.get("category"),
                    examples=result.get("examples"),
                    tags=result.get("tags"),
                    created_at=result.get("created_at"),
                    updated_at=result.get("updated_at"),
                    vector_score=result.get("vector_score"),
                    text_score=result.get("text_score"),
                    fusion_score=result.get("fusion_score"),
                    rerank_score=result.get("rerank_score"),
                    final_score=result.get("final_score"),
                    similarity_score=similarity_score,
                    search_metadata=result.get("hybrid_metadata"),
                    highlight=result.get("highlight")
                )
                response_results.append(ranked_result)

            # 构建响应
            timing["total"] = time.time() - start_time
            search_stats.update({
                "total_candidates": len(fused_results) if request.search_mode == "hybrid" else len(final_results),
                "final_results": len(response_results),
                "search_mode": request.search_mode,
                "rerank_enabled": request.enable_rerank
            })

            logger.info(f"[{request_id}] Hybrid search completed in {timing['total']:.3f}s")
            logger.info(f"[{request_id}] Returning {len(response_results)} final results")

            return HybridQueryResponse(
                results=response_results,
                query=request.query,
                total_results=len(response_results),
                search_mode=request.search_mode,
                timing=timing,
                search_stats=search_stats
            )

        except Exception as e:
            timing["total"] = time.time() - start_time
            logger.error(f"[{request_id}] Hybrid search failed after {timing['total']:.3f}s: {e}")
            raise

    async def smart_query_documents(
        self,
        request: QueryRequest,
        request_id: Optional[str] = None
    ) -> QueryResponse:
        """
        智能查询文档 - 根据请求参数自动选择搜索策略

        Args:
            request: 查询请求（支持混合搜索参数）
            request_id: 请求ID用于追踪

        Returns:
            查询响应（包含混合搜索结果信息）
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        start_time = time.time()
        logger.info(f"[{request_id}] Smart query: '{request.query[:50]}...', mode: {request.search_mode}")

        try:
            # 根据搜索模式选择策略
            if request.search_mode == "vector":
                # 纯向量搜索 - 使用原有逻辑保持向后兼容
                response = await self.query_documents(
                    query=request.query,
                    n_results=request.n_results,
                    include_metadata=request.include_metadata
                )

                # 转换为增强格式
                enhanced_results = []
                for result in response.results:
                    # 创建临时结果字典用于计算相似度分数
                    temp_result = {
                        "distance": result.distance,
                        "vector_score": math.exp(-abs(result.distance)) if result.distance != float('inf') else 0.0,
                    }
                    similarity_score = self._calculate_similarity_score(temp_result, "vector")
                    
                    enhanced_result = DocumentResult(
                        id=result.id,
                        content=result.content,
                        distance=result.distance,
                        metadata=result.metadata,
                        vector_score=math.exp(-abs(result.distance)) if result.distance != float('inf') else 0.0,
                        final_score=math.exp(-abs(result.distance)) if result.distance != float('inf') else 0.0,
                        similarity_score=similarity_score
                    )
                    enhanced_results.append(enhanced_result)

                return QueryResponse(
                    results=enhanced_results,
                    query=request.query,
                    total_results=len(enhanced_results),
                    search_mode="vector",
                    timing={"total": time.time() - start_time},
                    search_stats={"search_mode": "vector", "results_count": len(enhanced_results)}
                )

            else:
                # 文本搜索或混合搜索 - 使用混合搜索逻辑
                hybrid_request = HybridQueryRequest(
                    query=request.query,
                    n_results=request.n_results,
                    include_metadata=request.include_metadata,
                    search_mode=request.search_mode,
                    vector_weight=request.vector_weight,
                    text_weight=request.text_weight,
                    enable_rerank=request.enable_rerank,
                    rerank_top_k=request.rerank_top_k
                )

                hybrid_response = await self.hybrid_query_documents(
                    request=hybrid_request,
                    request_id=request_id
                )

                # 转换为标准格式
                standard_results = []
                for ranked_result in hybrid_response.results:
                    standard_result = DocumentResult(
                        id=ranked_result.id,
                        content="",  # 混合搜索不返回完整内容
                        distance=1.0 - (ranked_result.final_score or 0.0),  # 转换分数为距离
                        metadata={
                            "title": ranked_result.title,
                            "description": ranked_result.description,
                            "category": ranked_result.category,
                            "examples": ranked_result.examples,
                            "tags": ranked_result.tags,
                            "created_at": ranked_result.created_at,
                            "updated_at": ranked_result.updated_at
                        } if ranked_result.title else None,
                        vector_score=ranked_result.vector_score,
                        text_score=ranked_result.text_score,
                        fusion_score=ranked_result.fusion_score,
                        rerank_score=ranked_result.rerank_score,
                        final_score=ranked_result.final_score,
                        similarity_score=ranked_result.similarity_score,
                        highlight=ranked_result.highlight
                    )
                    standard_results.append(standard_result)

                return QueryResponse(
                    results=standard_results,
                    query=request.query,
                    total_results=len(standard_results),
                    search_mode=hybrid_response.search_mode,
                    timing=hybrid_response.timing,
                    search_stats=hybrid_response.search_stats
                )

        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[{request_id}] Smart query failed after {total_time:.3f}s: {e}")
            raise

    def _parse_json_field(self, json_str: str) -> Any:
        """
        解析JSON字段

        Args:
            json_str: JSON字符串

        Returns:
            解析后的对象
        """
        try:
            import json
            return json.loads(json_str) if json_str else []
        except (json.JSONDecodeError, TypeError):
            return []
    
    async def upsert_documents(
        self,
        documents: List[DocumentInput],
        request_id: Optional[str] = None
    ) -> bool:
        """
        更新或插入文档到知识库（upsert操作到 ChromaDB 和 Elasticsearch）

        Args:
            documents: 文档列表
            request_id: 请求ID用于追踪

        Returns:
            是否成功
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        try:
            # 提取文档内容和元数据
            contents = [doc.content for doc in documents]
            ids = [doc.id for doc in documents]
            metadatas = [doc.metadata for doc in documents if doc.metadata]

            # 如果没有元数据，设置为 None
            if not metadatas or len(metadatas) != len(documents):
                metadatas = None

            # 生成嵌入向量
            logger.info(f"[{request_id}] 正在为 {len(documents)} 个文档生成嵌入向量...")
            embeddings = await self.embedding_service.encode_batch(contents)

            # 并行 upsert 到 ChromaDB 和 Elasticsearch
            logger.info(f"[{request_id}] 正在并行 upsert 文档到 ChromaDB 和 Elasticsearch...")

            chroma_task = self.chroma_service.upsert_documents(
                collection_name=self.collection_name,
                documents=contents,
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas
            )

            # Elasticsearch使用相同的add_documents方法（内部会处理upsert）
            es_task = self.elasticsearch_service.add_documents(
                documents=documents,
                request_id=request_id
            )

            # 等待两个操作完成
            chroma_success, es_success = await asyncio.gather(
                chroma_task, es_task, return_exceptions=True
            )

            # 检查结果
            if isinstance(chroma_success, Exception):
                logger.error(f"[{request_id}] ChromaDB upsert 失败: {chroma_success}")
                chroma_success = False

            if isinstance(es_success, Exception):
                logger.error(f"[{request_id}] Elasticsearch upsert 失败: {es_success}")
                es_success = False

            # 如果全部失败或部分失败，记录错误
            if not chroma_success or not es_success:
                logger.warning(f"[{request_id}] Upsert 部分失败 - ChromaDB: {chroma_success}, ES: {es_success}")
                # 对于upsert操作，我们不回滚，只是记录失败
                return chroma_success or es_success  # 至少一个成功就返回True

            logger.info(f"[{request_id}] 成功 upsert {len(documents)} 个文档到双重存储系统")
            return True

        except Exception as e:
            logger.error(f"[{request_id}] Upsert文档到知识库失败: {e}")
            raise

    async def delete_documents(
        self,
        ids: List[str],
        request_id: Optional[str] = None
    ) -> bool:
        """
        删除文档（从 ChromaDB 和 Elasticsearch 中删除）

        Args:
            ids: 文档ID列表
            request_id: 请求ID用于追踪

        Returns:
            是否成功
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        try:
            logger.info(f"[{request_id}] 正在从双重存储系统删除 {len(ids)} 个文档")

            # 并行删除
            chroma_task = self.chroma_service.delete_documents(
                collection_name=self.collection_name,
                ids=ids
            )

            es_task = self.elasticsearch_service.delete_documents(
                ids=ids,
                request_id=request_id
            )

            # 等待两个操作完成
            chroma_success, es_success = await asyncio.gather(
                chroma_task, es_task, return_exceptions=True
            )

            # 检查结果
            if isinstance(chroma_success, Exception):
                logger.error(f"[{request_id}] ChromaDB 删除失败: {chroma_success}")
                chroma_success = False

            if isinstance(es_success, Exception):
                logger.error(f"[{request_id}] Elasticsearch 删除失败: {es_success}")
                es_success = False

            # 记录结果
            if chroma_success and es_success:
                logger.info(f"[{request_id}] 成功从双重存储系统删除 {len(ids)} 个文档")
                return True
            elif chroma_success or es_success:
                logger.warning(f"[{request_id}] 部分删除成功 - ChromaDB: {chroma_success}, ES: {es_success}")
                return True  # 至少一个成功
            else:
                logger.error(f"[{request_id}] 删除失败 - ChromaDB: {chroma_success}, ES: {es_success}")
                return False

        except Exception as e:
            logger.error(f"[{request_id}] 删除文档失败: {e}")
            raise
    
    async def get_document_by_id(
        self,
        document_id: str,
        request_id: Optional[str] = None
    ) -> Optional[DocumentResult]:
        """
        根据ID直接获取文档

        Args:
            document_id: 文档ID
            request_id: 请求ID用于追踪

        Returns:
            文档结果，如果不存在则返回 None
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        try:
            logger.info(f"[{request_id}] 根据ID获取文档: {document_id}")

            # 优先从 ChromaDB 获取（向量数据库更适合存储完整文档）
            try:
                chroma_doc = await self.chroma_service.get_document_by_id(
                    collection_name=self.collection_name,
                    document_id=document_id
                )

                if chroma_doc:
                    logger.info(f"[{request_id}] 成功从 ChromaDB 获取文档 {document_id}")
                    return DocumentResult(
                        id=chroma_doc["id"],
                        content=chroma_doc["content"],
                        distance=0.0,  # 精确匹配，距离为0
                        metadata=chroma_doc["metadata"],
                        similarity_score=100.0  # 精确匹配给满分
                    )

            except Exception as e:
                logger.warning(f"[{request_id}] 从 ChromaDB 获取文档失败，尝试 Elasticsearch: {e}")

            # 如果 ChromaDB 失败，尝试从 Elasticsearch 获取
            try:
                es_doc = await self.elasticsearch_service.get_document_by_id(document_id)

                if es_doc:
                    logger.info(f"[{request_id}] 成功从 Elasticsearch 获取文档 {document_id}")
                    return DocumentResult(
                        id=es_doc["id"],
                        content=es_doc["content"],
                        distance=0.0,  # 精确匹配，距离为0
                        metadata=es_doc["metadata"],
                        similarity_score=100.0  # 精确匹配给满分
                    )

            except Exception as e:
                logger.warning(f"[{request_id}] 从 Elasticsearch 获取文档失败: {e}")

            logger.info(f"[{request_id}] 文档 {document_id} 在所有存储系统中都不存在")
            return None

        except Exception as e:
            logger.error(f"[{request_id}] 根据ID获取文档失败: {e}")
            raise

    async def get_collection_info(self) -> Dict[str, Any]:
        """
        获取集合信息

        Args:
            collection_name: 集合名称

        Returns:
            集合信息
        """
        try:
            return await self.chroma_service.get_collection_info(self.collection_name)
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
            return await self.chroma_service.list_collections()
        except Exception as e:
            logger.error(f"列出集合失败: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """
        健康检查
        
        Returns:
            服务状态信息
        """
        try:
            # 检查 ChromaDB 连接
            chroma_status = await self.chroma_service.ping()
            
            # 检查嵌入服务
            embedding_info = self.embedding_service.get_model_info()
            
            return {
                "chroma_db": {
                    "status": "healthy" if chroma_status else "unhealthy",
                    "host": self.chroma_service.host,
                    "port": self.chroma_service.port
                },
                "embedding_service": {
                    "status": "healthy" if embedding_info["is_loaded"] else "loading",
                    "model_name": embedding_info["model_name"]
                }
            }
            
        except Exception as e:
            logger.error(f"健康检查失败: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    async def clear_knowledge_base(self, request_id: Optional[str] = None) -> bool:
        """
        清空知识库（清空 ChromaDB 和 Elasticsearch）

        Args:
            request_id: 请求ID用于追踪

        Returns:
            是否成功
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        try:
            logger.info(f"[{request_id}] 正在清空双重存储系统的知识库")

            # 并行清空
            chroma_task = self.chroma_service.clear_collection(self.collection_name)
            es_task = self.elasticsearch_service.clear_index(request_id=request_id)

            # 等待两个操作完成
            chroma_success, es_success = await asyncio.gather(
                chroma_task, es_task, return_exceptions=True
            )

            # 检查结果
            if isinstance(chroma_success, Exception):
                logger.error(f"[{request_id}] ChromaDB 清空失败: {chroma_success}")
                chroma_success = False

            if isinstance(es_success, Exception):
                logger.error(f"[{request_id}] Elasticsearch 清空失败: {es_success}")
                es_success = False

            if chroma_success and es_success:
                logger.info(f"[{request_id}] 双重存储系统知识库清空成功")
                return True
            elif chroma_success or es_success:
                logger.warning(f"[{request_id}] 部分清空成功 - ChromaDB: {chroma_success}, ES: {es_success}")
                return True
            else:
                logger.error(f"[{request_id}] 清空失败 - ChromaDB: {chroma_success}, ES: {es_success}")
                return False

        except Exception as e:
            logger.error(f"[{request_id}] 清空知识库失败: {e}")
            raise


# 全局 RAG 服务实例
rag_service = RAGService()
