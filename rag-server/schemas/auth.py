"""
管理员认证相关的 Pydantic 模型
"""
from typing import Optional
from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    """管理员登录请求"""
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")


class AdminUser(BaseModel):
    """管理员用户信息"""
    id: int = Field(..., description="用户ID")
    username: str = Field(..., description="用户名")
    email: Optional[str] = Field(default=None, description="邮箱")
    is_active: bool = Field(default=True, description="是否激活")
    is_superuser: bool = Field(default=True, description="是否超级用户")


class AdminLoginResponse(BaseModel):
    """管理员登录响应"""
    access_token: str = Field(..., description="访问令牌")
    user: AdminUser = Field(..., description="用户信息")


class AdminProfileResponse(BaseModel):
    """管理员个人信息响应"""
    user: AdminUser = Field(..., description="用户信息")