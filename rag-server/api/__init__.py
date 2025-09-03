from fastapi import APIRouter
from .routes import embedding, auth

router = APIRouter()

# 包含各个模块的路由
router.include_router(embedding.router, prefix="/embedding", tags=["嵌入向量"])
router.include_router(auth.router, prefix="/admin", tags=["管理员认证"])
