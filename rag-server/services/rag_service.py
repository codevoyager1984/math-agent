"""
RAG 主服务模块
整合嵌入向量服务和 ChromaDB 服务，提供高层次的 RAG 功能
"""
from typing import List, Optional, Dict, Any
import logging

from .embedding_service import embedding_service
from .chroma_service import chroma_service
from schemas.embeddings import DocumentInput, DocumentResult, QueryResponse

logger = logging.getLogger(__name__)


class RAGService:
    """RAG 主服务类"""
    
    def __init__(self):
        """初始化 RAG 服务"""
        self.embedding_service = embedding_service
        self.chroma_service = chroma_service
    
    async def add_documents(
        self,
        documents: List[DocumentInput],
        collection_name: str = "math_knowledge"
    ) -> bool:
        """
        添加文档到知识库
        
        Args:
            documents: 文档列表
            collection_name: 集合名称
            
        Returns:
            是否成功
        """
        try:
            # 提取文档内容和元数据
            contents = [doc.content for doc in documents]
            ids = [doc.id for doc in documents]
            metadatas = [doc.metadata for doc in documents if doc.metadata]
            
            # 如果没有元数据，设置为 None
            if not metadatas or len(metadatas) != len(documents):
                metadatas = None
            
            # 生成嵌入向量
            logger.info(f"正在为 {len(documents)} 个文档生成嵌入向量...")
            embeddings = await self.embedding_service.encode_batch(contents)
            
            # 存储到 ChromaDB
            logger.info(f"正在将文档存储到集合 {collection_name}...")
            success = await self.chroma_service.add_documents(
                collection_name=collection_name,
                documents=contents,
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas
            )
            
            if success:
                logger.info(f"成功添加 {len(documents)} 个文档到知识库")
            
            return success
            
        except Exception as e:
            logger.error(f"添加文档到知识库失败: {e}")
            raise
    
    async def query_documents(
        self,
        query: str,
        collection_name: str = "math_knowledge",
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
            # 生成查询向量
            logger.info(f"正在为查询生成嵌入向量: {query[:50]}...")
            query_embedding = await self.embedding_service.encode(query)
            
            # 设置包含字段
            include = ["documents", "distances", "metadatas"] if include_metadata else ["documents", "distances"]
            
            # 查询 ChromaDB
            logger.info(f"正在查询集合 {collection_name}...")
            results = await self.chroma_service.query_documents(
                collection_name=collection_name,
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
                    document_result = DocumentResult(
                        id=doc_id,
                        content=documents[i] if i < len(documents) else "",
                        distance=distances[i] if i < len(distances) else 0.0,
                        metadata=metadatas[i] if i < len(metadatas) else None
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
    
    async def upsert_documents(
        self,
        documents: List[DocumentInput],
        collection_name: str = "math_knowledge"
    ) -> bool:
        """
        更新或插入文档到知识库（upsert操作）
        
        Args:
            documents: 文档列表
            collection_name: 集合名称
            
        Returns:
            是否成功
        """
        try:
            # 提取文档内容和元数据
            contents = [doc.content for doc in documents]
            ids = [doc.id for doc in documents]
            metadatas = [doc.metadata for doc in documents if doc.metadata]
            
            # 如果没有元数据，设置为 None
            if not metadatas or len(metadatas) != len(documents):
                metadatas = None
            
            # 生成嵌入向量
            logger.info(f"正在为 {len(documents)} 个文档生成嵌入向量...")
            embeddings = await self.embedding_service.encode_batch(contents)
            
            # Upsert到 ChromaDB
            logger.info(f"正在将文档upsert到集合 {collection_name}...")
            success = await self.chroma_service.upsert_documents(
                collection_name=collection_name,
                documents=contents,
                ids=ids,
                embeddings=embeddings,
                metadatas=metadatas
            )
            
            if success:
                logger.info(f"成功upsert {len(documents)} 个文档到知识库")
            
            return success
            
        except Exception as e:
            logger.error(f"Upsert文档到知识库失败: {e}")
            raise

    async def delete_documents(
        self,
        ids: List[str],
        collection_name: str = "math_knowledge"
    ) -> bool:
        """
        删除文档
        
        Args:
            ids: 文档ID列表
            collection_name: 集合名称
            
        Returns:
            是否成功
        """
        try:
            success = await self.chroma_service.delete_documents(
                collection_name=collection_name,
                ids=ids
            )
            
            if success:
                logger.info(f"成功删除 {len(ids)} 个文档")
            
            return success
            
        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            raise
    
    async def get_collection_info(self, collection_name: str = "math_knowledge") -> Dict[str, Any]:
        """
        获取集合信息
        
        Args:
            collection_name: 集合名称
            
        Returns:
            集合信息
        """
        try:
            return await self.chroma_service.get_collection_info(collection_name)
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
    
    async def clear_knowledge_base(self) -> bool:
        """
        清空知识库
        
        Returns:
            是否成功
        """
        try:
            success = await self.chroma_service.clear_collection("math_knowledge")
            if success:
                logger.info("知识库清空成功")
            return success
        except Exception as e:
            logger.error(f"清空知识库失败: {e}")
            raise


# 全局 RAG 服务实例
rag_service = RAGService()
