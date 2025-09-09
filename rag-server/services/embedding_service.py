"""
嵌入向量服务模块
负责文本到向量的转换
"""
import asyncio
from typing import List, Union
from sentence_transformers import SentenceTransformer
from loguru import logger

class EmbeddingService:
    """嵌入向量服务"""
    
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        """
        初始化嵌入向量服务
        
        Args:
            model_name: 使用的模型名称
        """
        self.model_name = model_name
        self._model = None
        self._lock = asyncio.Lock()
    
    async def _initialize_model(self):
        """异步初始化模型"""
        if self._model is None:
            async with self._lock:
                if self._model is None:  # 双重检查
                    logger.info(f"正在加载嵌入模型: {self.model_name}")
                    # 在线程池中加载模型以避免阻塞
                    loop = asyncio.get_event_loop()
                    self._model = await loop.run_in_executor(
                        None, 
                        lambda: SentenceTransformer(self.model_name)
                    )
                    logger.info("嵌入模型加载完成")
    
    async def encode(self, texts: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        """
        将文本编码为向量
        
        Args:
            texts: 单个文本或文本列表
            
        Returns:
            对应的向量或向量列表
        """
        await self._initialize_model()
        
        # 确保输入是列表格式
        is_single = isinstance(texts, str)
        if is_single:
            texts = [texts]
        
        try:
            # 在线程池中执行编码以避免阻塞
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(
                None,
                lambda: self._model.encode(texts).tolist()
            )
            
            # 如果输入是单个文本，返回单个向量
            if is_single:
                return embeddings[0]
            
            return embeddings
            
        except Exception as e:
            logger.error(f"文本编码失败: {e}")
            raise
    
    async def encode_batch(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """
        批量编码文本（用于大量文本的处理）
        
        Args:
            texts: 文本列表
            batch_size: 批次大小
            
        Returns:
            向量列表
        """
        await self._initialize_model()
        
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            
            # 在线程池中执行编码
            loop = asyncio.get_event_loop()
            batch_embeddings = await loop.run_in_executor(
                None,
                lambda: self._model.encode(batch).tolist()
            )
            
            all_embeddings.extend(batch_embeddings)
            
            # 可选：添加小延迟以避免过度占用资源
            if i + batch_size < len(texts):
                await asyncio.sleep(0.01)
        
        return all_embeddings
    
    def get_model_info(self) -> dict:
        """获取模型信息"""
        return {
            "model_name": self.model_name,
            "is_loaded": self._model is not None
        }


# 全局嵌入服务实例
embedding_service = EmbeddingService()
