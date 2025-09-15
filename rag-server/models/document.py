"""
文档相关的数据库模型
"""
from sqlalchemy import Column, String, Text, DateTime, Integer, JSON, Enum
from sqlalchemy.sql import func
from models.base import Base
import enum


class DocumentStatus(enum.Enum):
    """文档状态枚举"""
    UPLOADING = "uploading"      # 上传中
    PROCESSING = "processing"    # 处理中
    COMPLETED = "completed"      # 已完成
    FAILED = "failed"           # 处理失败


class ChatSessionStatus(enum.Enum):
    """聊天会话状态枚举"""
    ACTIVE = "active"           # 活跃中
    COMPLETED = "completed"     # 已完成
    EXPIRED = "expired"         # 已过期


class Document(Base):
    """文档表"""
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, comment="文档ID")
    filename = Column(String(255), nullable=False, comment="文件名")
    original_filename = Column(String(255), nullable=False, comment="原始文件名")
    file_size = Column(Integer, nullable=False, comment="文件大小（字节）")
    file_type = Column(String(50), nullable=False, comment="文件类型")
    
    # 文本内容
    extracted_text = Column(Text, nullable=False, comment="提取的文本内容")
    text_preview = Column(Text, comment="文本预览（前2000字符）")
    
    # 处理状态
    status = Column(Enum(DocumentStatus), default=DocumentStatus.UPLOADING, comment="处理状态")
    error_message = Column(Text, comment="错误信息")
    
    # 用户要求
    user_requirements = Column(Text, comment="用户特殊要求")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    # 额外信息
    extra_data = Column(JSON, comment="额外数据")


class ChatSession(Base):
    """聊天会话表"""
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, comment="会话ID")
    document_id = Column(String(36), nullable=False, comment="关联的文档ID")
    
    # 会话状态
    status = Column(Enum(ChatSessionStatus), default=ChatSessionStatus.ACTIVE, comment="会话状态")
    
    # 知识点数据
    current_knowledge_points = Column(JSON, comment="当前生成的知识点")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    last_activity = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="最后活动时间")
    
    # 额外信息
    session_data = Column(JSON, comment="会话数据")


class ChatMessage(Base):
    """聊天消息表"""
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, comment="消息ID")
    session_id = Column(String(36), nullable=False, comment="会话ID")
    
    # 消息内容
    role = Column(String(20), nullable=False, comment="角色：user, assistant, system")
    content = Column(Text, nullable=False, comment="消息内容")
    reasoning = Column(Text, comment="AI思考过程")
    
    # 消息类型和状态
    message_type = Column(String(50), default="text", comment="消息类型")
    knowledge_points = Column(JSON, comment="关联的知识点数据")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    
    # 额外信息
    message_data = Column(JSON, comment="消息数据")
