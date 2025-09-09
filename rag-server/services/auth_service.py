"""
管理员认证服务模块
"""
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from schemas.auth import AdminUser, AdminLoginResponse
from repositories.admin_user import AdminUserRepository
from loguru import logger


class AuthService:
    """管理员认证服务"""
    
    def __init__(self):
        """初始化认证服务"""
        # 存储活跃的访问令牌
        self._active_tokens: Dict[str, Dict[str, Any]] = {}
        self.admin_user_repository = AdminUserRepository()
    
    def _generate_token(self) -> str:
        """生成访问令牌"""
        return secrets.token_urlsafe(32)
    
    def _convert_db_user_to_schema(self, db_user) -> AdminUser:
        """将数据库用户模型转换为 Schema 用户模型"""
        return AdminUser(
            id=db_user.id,
            username=db_user.username,
            email=db_user.email,
            is_active=db_user.is_active,
            is_superuser=db_user.is_superuser
        )
    
    async def authenticate_user(self, username: str, password: str) -> Optional[AdminUser]:
        """
        验证用户凭据
        
        Args:
            username: 用户名
            password: 密码
            
        Returns:
            验证成功返回用户信息，失败返回 None
        """
        try:
            logger.info(f"尝试验证用户: {username}")
            
            # 从数据库验证用户
            db_user = await self.admin_user_repository.authenticate_admin_user(username, password)
            
            if not db_user:
                return None
            
            # 转换为 Schema 用户模型
            user = self._convert_db_user_to_schema(db_user)
            
            logger.info(f"用户验证成功: {username}")
            return user
            
        except Exception as e:
            logger.error(f"用户验证失败: {e}")
            return None
    
    async def login(self, username: str, password: str) -> Optional[AdminLoginResponse]:
        """
        管理员登录
        
        Args:
            username: 用户名
            password: 密码
            
        Returns:
            登录成功返回响应数据，失败返回 None
        """
        try:
            # 验证用户
            user = await self.authenticate_user(username, password)
            if not user:
                return None
            
            # 生成访问令牌
            access_token = self._generate_token()
            
            # 存储令牌信息
            token_data = {
                "user_id": user.id,
                "username": user.username,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=24)  # 24小时过期
            }
            self._active_tokens[access_token] = token_data
            
            # 创建登录响应
            response = AdminLoginResponse(
                access_token=access_token,
                user=user
            )
            
            logger.info(f"用户登录成功: {username}, 令牌: {access_token[:10]}...")
            return response
            
        except Exception as e:
            logger.error(f"登录处理失败: {e}")
            return None
    
    async def verify_token(self, token: str) -> Optional[AdminUser]:
        """
        验证访问令牌
        
        Args:
            token: 访问令牌
            
        Returns:
            验证成功返回用户信息，失败返回 None
        """
        try:
            # 查找令牌
            token_data = self._active_tokens.get(token)
            if not token_data:
                logger.warning(f"令牌不存在: {token[:10]}...")
                return None
            
            # 检查是否过期
            if datetime.utcnow() > token_data["expires_at"]:
                logger.warning(f"令牌已过期: {token[:10]}...")
                # 删除过期令牌
                del self._active_tokens[token]
                return None
            
            # 从数据库获取最新的用户信息
            user_id = token_data["user_id"]
            db_user = await self.admin_user_repository.get_admin_user_by_id(user_id)
            
            if not db_user or not db_user.is_active:
                logger.warning(f"令牌对应的用户无效或已禁用: {user_id}")
                # 删除无效用户的令牌
                del self._active_tokens[token]
                return None
            
            # 转换为 Schema 用户模型
            user = self._convert_db_user_to_schema(db_user)
            
            return user
            
        except Exception as e:
            logger.error(f"令牌验证失败: {e}")
            return None
    
    async def logout(self, token: str) -> bool:
        """
        用户登出
        
        Args:
            token: 访问令牌
            
        Returns:
            是否成功
        """
        try:
            if token in self._active_tokens:
                username = self._active_tokens[token]["username"]
                del self._active_tokens[token]
                logger.info(f"用户登出成功: {username}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"登出处理失败: {e}")
            return False
    
    def get_active_tokens_count(self) -> int:
        """获取活跃令牌数量"""
        # 清理过期令牌
        now = datetime.utcnow()
        expired_tokens = [
            token for token, data in self._active_tokens.items()
            if now > data["expires_at"]
        ]
        for token in expired_tokens:
            del self._active_tokens[token]
        
        return len(self._active_tokens)
    
    async def get_service_info(self) -> Dict[str, Any]:
        """获取服务信息"""
        try:
            # 从数据库获取注册用户数量
            registered_users = await self.admin_user_repository.get_admin_users_count()
            
            return {
                "registered_users": registered_users,
                "active_sessions": self.get_active_tokens_count(),
                "token_expiry_hours": 24
            }
        except Exception as e:
            logger.error(f"获取服务信息失败: {e}")
            return {
                "registered_users": 0,
                "active_sessions": self.get_active_tokens_count(),
                "token_expiry_hours": 24
            }


# 全局认证服务实例
auth_service = AuthService()
