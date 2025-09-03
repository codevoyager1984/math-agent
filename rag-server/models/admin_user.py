from sqlalchemy import Column, String, Boolean
from .base import BaseModel

class AdminUser(BaseModel):
    __tablename__ = "admin_users"

    username = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    
    def to_dict(self):
        base_dict = super().to_dict()
        base_dict.update({
            "username": self.username,
            "email": self.email,
            "is_active": self.is_active,
            "is_superuser": self.is_superuser,
        })
        # Don't include password in dict representation
        return base_dict
