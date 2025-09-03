"""
配置文件
"""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """应用配置"""
    
    # 服务配置
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # ChromaDB 配置
    CHROMA_HOST: str = os.getenv("CHROMA_HOST", "localhost")
    CHROMA_PORT: int = int(os.getenv("CHROMA_PORT", "18000"))
    
    # 嵌入模型配置
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    
    # 默认集合名称
    DEFAULT_COLLECTION: str = os.getenv("DEFAULT_COLLECTION", "math_knowledge")
    
    # 批处理配置
    BATCH_SIZE: int = int(os.getenv("BATCH_SIZE", "32"))
    
    # 日志配置
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "rag_server.log")
    
    # CORS 配置
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    DATABASE_URL: str = os.getenv("DATABASE_URL")
    
    @property
    def cors_origins_list(self) -> list:
        """返回 CORS 允许的源列表"""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


# 全局配置实例
settings = Settings()
