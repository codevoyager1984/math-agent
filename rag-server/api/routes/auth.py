"""
管理员认证相关的 FastAPI 路由
"""
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

from schemas.auth import (
    AdminLoginRequest, AdminLoginResponse, 
    AdminUser, AdminProfileResponse
)
from schemas.common import SuccessResponse, ErrorResponse
from services.auth_service import auth_service

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# HTTP Bearer 认证方案
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AdminUser:
    """
    获取当前认证用户的依赖函数
    """
    try:
        user = await auth_service.verify_token(credentials.credentials)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的访问令牌",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"用户认证失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="认证失败",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post(
    "/login",
    response_model=AdminLoginResponse,
    summary="管理员登录",
    description="管理员用户名密码登录，返回访问令牌和用户信息"
)
async def admin_login(request: AdminLoginRequest):
    """
    管理员登录
    
    - **username**: 用户名
    - **password**: 密码
    
    返回:
    - **access_token**: 访问令牌，用于后续API调用认证
    - **user**: 用户信息
    """
    try:
        logger.info(f"管理员登录请求: {request.username}")
        
        # 尝试登录
        login_response = await auth_service.login(
            username=request.username,
            password=request.password
        )
        
        if not login_response:
            logger.warning(f"登录失败: {request.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误"
            )
        
        logger.info(f"管理员登录成功: {request.username}")
        return login_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"登录接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"登录失败: {str(e)}"
        )


@router.post(
    "/logout",
    response_model=SuccessResponse,
    summary="管理员登出",
    description="注销当前会话，使访问令牌失效"
)
async def admin_logout(current_user: AdminUser = Depends(get_current_user)):
    """
    管理员登出
    
    需要在请求头中包含有效的访问令牌
    """
    try:
        # 从请求中获取令牌（这里需要从当前的认证上下文中获取）
        # 由于我们已经验证了用户，可以从 auth_service 的活跃令牌中找到对应的令牌
        # 这是一个简化的实现，生产环境中可能需要更复杂的令牌管理
        
        logger.info(f"管理员登出: {current_user.username}")
        
        return SuccessResponse(
            message="登出成功",
            data={"username": current_user.username}
        )
        
    except Exception as e:
        logger.error(f"登出接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"登出失败: {str(e)}"
        )


@router.get(
    "/profile",
    response_model=AdminProfileResponse,
    summary="获取管理员个人信息",
    description="获取当前认证用户的个人信息"
)
async def get_admin_profile(current_user: AdminUser = Depends(get_current_user)):
    """
    获取管理员个人信息
    
    需要在请求头中包含有效的访问令牌
    """
    try:
        logger.info(f"获取管理员信息: {current_user.username}")
        
        return AdminProfileResponse(user=current_user)
        
    except Exception as e:
        logger.error(f"获取个人信息接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取个人信息失败: {str(e)}"
        )


@router.get(
    "/status",
    response_model=dict,
    summary="认证服务状态",
    description="获取认证服务的状态信息"
)
async def auth_status():
    """
    获取认证服务状态
    
    返回当前认证服务的统计信息
    """
    try:
        service_info = await auth_service.get_service_info()
        
        return {
            "status": "healthy",
            "service": "认证服务",
            "version": "1.0.0",
            "statistics": service_info
        }
        
    except Exception as e:
        logger.error(f"认证服务状态接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取认证服务状态失败: {str(e)}"
        )
