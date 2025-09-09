"""
数据库服务模块
负责数据库操作的封装
"""
import hashlib
from typing import Optional, List
from sqlalchemy.exc import SQLAlchemyError

from models.base import get_db_session
from models.admin_user import AdminUser as AdminUserModel
from loguru import logger



class AdminUserRepository:
    """数据库服务类"""
    
    def __init__(self):
        """初始化数据库服务"""
        self.salt = "mathagent_salt_2024"
    
    def _hash_password(self, password: str) -> str:
        """对密码进行哈希处理"""
        return hashlib.sha256((password + self.salt).encode()).hexdigest()
    
    def _verify_password(self, password: str, password_hash: str) -> bool:
        """验证密码"""
        return self._hash_password(password) == password_hash
    
    async def create_admin_user(
        self, 
        username: str, 
        password: str, 
        email: Optional[str] = None,
        is_superuser: bool = False
    ) -> Optional[AdminUserModel]:
        """
        创建管理员用户
        
        Args:
            username: 用户名
            password: 密码
            email: 邮箱
            is_superuser: 是否为超级用户
            
        Returns:
            创建成功返回用户模型，失败返回 None
        """
        try:
            db = next(get_db_session())
            
            # 检查用户名是否已存在
            existing_user = db.query(AdminUserModel).filter(
                AdminUserModel.username == username
            ).first()
            
            if existing_user:
                logger.warning(f"用户名已存在: {username}")
                return None
            
            # 检查邮箱是否已存在
            if email:
                existing_email = db.query(AdminUserModel).filter(
                    AdminUserModel.email == email
                ).first()
                
                if existing_email:
                    logger.warning(f"邮箱已存在: {email}")
                    return None
            
            # 创建新用户
            hashed_password = self._hash_password(password)
            new_user = AdminUserModel(
                username=username,
                password=hashed_password,
                email=email,
                is_active=True,
                is_superuser=is_superuser
            )
            
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            logger.info(f"创建管理员用户成功: {username}")
            return new_user
            
        except SQLAlchemyError as e:
            logger.error(f"创建管理员用户数据库错误: {e}")
            db.rollback()
            return None
        except Exception as e:
            logger.error(f"创建管理员用户失败: {e}")
            return None
        finally:
            db.close()
    
    async def get_admin_user_by_username(self, username: str) -> Optional[AdminUserModel]:
        """
        根据用户名获取管理员用户
        
        Args:
            username: 用户名
            
        Returns:
            找到返回用户模型，未找到返回 None
        """
        try:
            db = next(get_db_session())
            
            user = db.query(AdminUserModel).filter(
                AdminUserModel.username == username
            ).first()
            
            return user
            
        except SQLAlchemyError as e:
            logger.error(f"查询用户数据库错误: {e}")
            return None
        except Exception as e:
            logger.error(f"查询用户失败: {e}")
            return None
        finally:
            db.close()
    
    async def get_admin_user_by_id(self, user_id: int) -> Optional[AdminUserModel]:
        """
        根据用户ID获取管理员用户
        
        Args:
            user_id: 用户ID
            
        Returns:
            找到返回用户模型，未找到返回 None
        """
        try:
            db = next(get_db_session())
            
            user = db.query(AdminUserModel).filter(
                AdminUserModel.id == user_id
            ).first()
            
            return user
            
        except SQLAlchemyError as e:
            logger.error(f"查询用户数据库错误: {e}")
            return None
        except Exception as e:
            logger.error(f"查询用户失败: {e}")
            return None
        finally:
            db.close()
    
    async def authenticate_admin_user(self, username: str, password: str) -> Optional[AdminUserModel]:
        """
        验证管理员用户凭据
        
        Args:
            username: 用户名
            password: 密码
            
        Returns:
            验证成功返回用户模型，失败返回 None
        """
        try:
            user = await self.get_admin_user_by_username(username)
            
            if not user:
                logger.warning(f"用户不存在: {username}")
                return None
            
            if not user.is_active:
                logger.warning(f"用户已禁用: {username}")
                return None
            
            if not self._verify_password(password, user.password):
                logger.warning(f"密码错误: {username}")
                return None
            
            logger.info(f"用户验证成功: {username}")
            return user
            
        except Exception as e:
            logger.error(f"用户验证失败: {e}")
            return None
    
    async def update_admin_user_password(self, username: str, new_password: str) -> bool:
        """
        更新管理员用户密码
        
        Args:
            username: 用户名
            new_password: 新密码
            
        Returns:
            是否成功
        """
        try:
            db = next(get_db_session())
            
            user = db.query(AdminUserModel).filter(
                AdminUserModel.username == username
            ).first()
            
            if not user:
                logger.warning(f"用户不存在: {username}")
                return False
            
            # 更新密码
            user.password = self._hash_password(new_password)
            db.commit()
            
            logger.info(f"更新用户密码成功: {username}")
            return True
            
        except SQLAlchemyError as e:
            logger.error(f"更新密码数据库错误: {e}")
            db.rollback()
            return False
        except Exception as e:
            logger.error(f"更新密码失败: {e}")
            return False
        finally:
            db.close()
    
    async def get_all_admin_users(self) -> List[AdminUserModel]:
        """
        获取所有管理员用户
        
        Returns:
            用户列表
        """
        try:
            db = next(get_db_session())
            
            users = db.query(AdminUserModel).all()
            return users
            
        except SQLAlchemyError as e:
            logger.error(f"查询所有用户数据库错误: {e}")
            return []
        except Exception as e:
            logger.error(f"查询所有用户失败: {e}")
            return []
        finally:
            db.close()
    
    async def get_admin_users_count(self) -> int:
        """
        获取管理员用户总数
        
        Returns:
            用户总数
        """
        try:
            db = next(get_db_session())
            
            count = db.query(AdminUserModel).count()
            return count
            
        except SQLAlchemyError as e:
            logger.error(f"统计用户数量数据库错误: {e}")
            return 0
        except Exception as e:
            logger.error(f"统计用户数量失败: {e}")
            return 0
        finally:
            db.close()
