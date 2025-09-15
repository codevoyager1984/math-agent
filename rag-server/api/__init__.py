from fastapi import APIRouter
from .routes import knowledge_base, auth, documents

router = APIRouter()

# 包含各个模块的路由
router.include_router(knowledge_base.router, prefix="/knowledge-base", tags=["知识库"])
router.include_router(documents.router, prefix="/documents", tags=["文档管理"])
router.include_router(auth.router, prefix="/admin", tags=["管理员认证"])
