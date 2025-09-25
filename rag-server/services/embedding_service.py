"""
嵌入向量服务模块
负责文本到向量的转换
"""
import asyncio
import os
from typing import List, Union
from sentence_transformers import SentenceTransformer
from loguru import logger
import requests
from requests.exceptions import RequestException, ConnectionError, Timeout

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
        
        # 配置模型缓存路径
        self.cache_folder = os.getenv('SENTENCE_TRANSFORMERS_HOME', '/app/model_cache')
        
        # 离线模式设置
        self.force_offline = os.getenv('TRANSFORMERS_OFFLINE', '0').lower() in ('1', 'true', 'yes')
    
    def _check_network_connectivity(self, timeout: int = 5) -> bool:
        """检查网络连接性"""
        try:
            # 尝试连接到 Hugging Face
            response = requests.head('https://huggingface.co/', timeout=timeout)
            return response.status_code == 200
        except (RequestException, ConnectionError, Timeout):
            try:
                # 如果 HF 不通，尝试连接到 HF Mirror
                response = requests.head('https://hf-mirror.com/', timeout=timeout)
                return response.status_code == 200
            except (RequestException, ConnectionError, Timeout):
                return False
    
    def _check_local_model_exists(self) -> bool:
        """检查本地模型是否存在"""
        if not os.path.exists(self.cache_folder):
            return False
        
        # 检查模型文件夹是否存在
        model_hash = self.model_name.replace("/", "--")
        model_dir = os.path.join(self.cache_folder, model_hash)
        
        if not os.path.exists(model_dir):
            return False
        
        # 检查关键文件是否存在
        required_files = ['config.json', 'pytorch_model.bin']
        for file_name in required_files:
            if not os.path.exists(os.path.join(model_dir, file_name)):
                # 如果pytorch_model.bin不存在，检查是否有safetensors格式
                if file_name == 'pytorch_model.bin':
                    safetensors_file = os.path.join(model_dir, 'model.safetensors')
                    if not os.path.exists(safetensors_file):
                        return False
                else:
                    return False
        
        return True
    
    async def _initialize_model(self):
        """异步初始化模型"""
        if self._model is None:
            async with self._lock:
                if self._model is None:  # 双重检查
                    logger.info(f"正在加载嵌入模型: {self.model_name}")
                    
                    # 检查本地模型是否存在
                    local_model_exists = self._check_local_model_exists()
                    cache_folder_exists = os.path.exists(self.cache_folder)
                    
                    # 如果缓存目录存在，强制使用离线模式
                    if cache_folder_exists:
                        logger.info(f"缓存目录存在 ({self.cache_folder})，强制使用离线模式")
                        use_offline_mode = True
                        network_available = False
                    else:
                        # 检查网络连接（除非强制离线模式）
                        network_available = False
                        if not self.force_offline:
                            logger.info("缓存目录不存在，检查网络连接性...")
                            loop = asyncio.get_event_loop()
                            network_available = await loop.run_in_executor(
                                None, self._check_network_connectivity
                            )
                            logger.info(f"网络连接状态: {'可用' if network_available else '不可用'}")
                        
                        # 决定加载策略
                        use_offline_mode = self.force_offline or not network_available
                    
                    if cache_folder_exists and use_offline_mode:
                        logger.info(f"使用离线模式加载模型: {self.cache_folder}")
                        # 设置环境变量强制离线模式
                        os.environ['TRANSFORMERS_OFFLINE'] = '1'
                        os.environ['HF_HUB_OFFLINE'] = '1'
                        
                        loop = asyncio.get_event_loop()
                        try:
                            self._model = await loop.run_in_executor(
                                None, 
                                lambda: SentenceTransformer(
                                    self.model_name, 
                                    cache_folder=self.cache_folder
                                )
                            )
                            logger.info("离线模式模型加载完成")
                        except Exception as e:
                            logger.error(f"离线模式加载失败: {e}")
                            if not local_model_exists:
                                error_msg = f"缓存目录存在但模型文件不完整，且强制离线模式: {e}"
                                logger.error(error_msg)
                                raise RuntimeError(error_msg)
                            else:
                                raise
                        
                    elif local_model_exists:
                        logger.info(f"使用本地缓存模型（允许网络检查）: {self.cache_folder}")
                        loop = asyncio.get_event_loop()
                        try:
                            self._model = await loop.run_in_executor(
                                None, 
                                lambda: SentenceTransformer(
                                    self.model_name, 
                                    cache_folder=self.cache_folder
                                )
                            )
                            logger.info("本地缓存模型加载完成")
                        except Exception as e:
                            logger.warning(f"本地缓存模型加载失败: {e}")
                            # 回退到离线模式
                            logger.info("回退到强制离线模式")
                            os.environ['TRANSFORMERS_OFFLINE'] = '1'
                            os.environ['HF_HUB_OFFLINE'] = '1'
                            self._model = await loop.run_in_executor(
                                None, 
                                lambda: SentenceTransformer(
                                    self.model_name, 
                                    cache_folder=self.cache_folder
                                )
                            )
                            logger.info("离线模式回退加载完成")
                            
                    elif network_available:
                        logger.info("本地模型不存在，使用网络下载模型")
                        if os.path.exists(self.cache_folder):
                            logger.info(f"使用缓存目录: {self.cache_folder}")
                            loop = asyncio.get_event_loop()
                            self._model = await loop.run_in_executor(
                                None, 
                                lambda: SentenceTransformer(
                                    self.model_name, 
                                    cache_folder=self.cache_folder
                                )
                            )
                        else:
                            logger.warning(f"缓存目录不存在: {self.cache_folder}，将使用默认路径下载模型")
                            loop = asyncio.get_event_loop()
                            self._model = await loop.run_in_executor(
                                None, 
                                lambda: SentenceTransformer(self.model_name)
                            )
                        logger.info("网络下载模型加载完成")
                        
                    else:
                        error_msg = f"无法加载模型 {self.model_name}: 本地模型不存在且网络不可用"
                        logger.error(error_msg)
                        raise RuntimeError(error_msg)
    
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
            "is_loaded": self._model is not None,
            "cache_folder": self.cache_folder,
            "force_offline": self.force_offline,
            "local_model_exists": self._check_local_model_exists(),
            "cache_folder_exists": os.path.exists(self.cache_folder)
        }


# 全局嵌入服务实例
embedding_service = EmbeddingService()
