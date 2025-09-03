"""
FastAPI RAG 服务主应用
"""
import logging
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time

from api import router
from schemas.common import ErrorResponse
from services.rag_service import rag_service
from config import settings


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('rag_server.log')
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时的初始化
    logger.info("🚀 RAG 服务正在启动...")
    
    # 这里可以添加预加载模型等初始化操作
    try:
        # 预热嵌入服务（可选）
        logger.info("正在预热服务...")
        await rag_service.health_check()
        logger.info("✅ RAG 服务启动完成")
    except Exception as e:
        logger.error(f"❌ 服务启动时发生错误: {e}")
        # 根据需要决定是否继续启动
    
    yield
    
    # 关闭时的清理
    logger.info("🛑 RAG 服务正在关闭...")
    logger.info("✅ RAG 服务已关闭")



# 创建 FastAPI 应用
app = FastAPI(
    title="数学知识 RAG 服务",
    description="""
    基于 ChromaDB 和 Sentence Transformers 的数学知识检索增强生成服务
    
    ## 功能特性
    
    * **文档管理**: 添加、删除数学知识文档
    * **智能检索**: 基于语义相似度的文档检索
    * **异步处理**: 所有接口都是异步的，支持高并发
    * **健康监控**: 实时监控服务组件状态
    
    ## 使用方法
    
    1. 使用 `/documents` 接口添加数学知识文档
    2. 使用 `/query` 接口查询相关知识
    3. 使用 `/health` 接口检查服务状态
    """,
    version="1.0.0",
    contact={
        "name": "RAG 服务支持",
        "email": "support@example.com",
    },
    license_info={
        "name": "MIT",
    },
    lifespan=lifespan
)

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 错误处理器
@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """通用异常处理器"""
    logger.error(f"未处理的异常: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="Internal Server Error",
            detail=str(exc)
        ).dict()
    )



# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """记录请求日志"""
    start_time = time.time()
    
    # 记录请求信息
    logger.info(f"📥 {request.method} {request.url.path} - 客户端: {request.client.host if request.client else 'unknown'}")
    
    # 处理请求
    response = await call_next(request)
    
    # 计算处理时间
    process_time = time.time() - start_time
    
    # 记录响应信息
    logger.info(f"📤 {request.method} {request.url.path} - 状态: {response.status_code} - 耗时: {process_time:.3f}s")
    
    return response


# 全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器"""
    logger.error(f"❌ 未处理的异常 {request.method} {request.url.path}: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal Server Error",
            detail="服务器内部错误，请稍后重试"
        ).dict()
    )


# 包含路由
app.include_router(router, prefix="/api")


# 根路径
@app.get("/", tags=["基础"])
async def read_root():
    """根路径 - 服务信息"""
    return {
        "service": "数学知识 RAG 服务",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health"
    }


# 如果直接运行此文件
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.HOT_RELOAD,  # 开发模式
        log_level="info"
    )
