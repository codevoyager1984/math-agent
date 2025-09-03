"""
通用的 Pydantic 模型
"""
from typing import Optional
from pydantic import BaseModel, Field


class HealthCheck(BaseModel):
    """健康检查响应"""
    status: str = Field(..., description="服务状态")
    version: str = Field(..., description="版本信息")


class ErrorResponse(BaseModel):
    """错误响应模型"""
    error: str = Field(..., description="错误信息")
    detail: Optional[str] = Field(default=None, description="详细错误信息")


class SuccessResponse(BaseModel):
    """成功响应模型"""
    message: str = Field(..., description="成功信息")
    data: Optional[dict] = Field(default=None, description="响应数据")