"""
文档解析聊天会话管理服务
"""
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from models.document import Document, ChatSession as DBChatSession, ChatMessage as DBChatMessage, ChatSessionStatus
from models.base import get_db
from loguru import logger


class ChatMessage(BaseModel):
    """聊天消息模型"""
    id: str
    role: str  # "user" | "assistant" | "system"
    content: str
    reasoning: Optional[str] = None  # AI思考过程
    timestamp: datetime
    message_type: str = "text"  # "text" | "knowledge_points" | "error"
    knowledge_points: Optional[List[Dict[str, Any]]] = None


class ChatSession(BaseModel):
    """聊天会话模型"""
    session_id: str
    filename: str
    extracted_text: str
    messages: List[ChatMessage] = Field(default_factory=list)
    current_knowledge_points: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    last_activity: datetime
    status: str = "active"  # "active" | "completed" | "expired"
    user_requirements: Optional[str] = None


class ChatSessionService:
    """聊天会话管理服务"""

    def __init__(self):
        # 聊天会话管理服务，直接使用数据库存储
        pass

    def create_session_with_document(
        self,
        filename: str,
        original_filename: str,
        file_size: int,
        file_type: str,
        extracted_text: str,
        user_requirements: Optional[str] = None
    ) -> tuple[str, str]:
        """创建文档和会话记录，返回(document_id, session_id)"""
        from services.document_service import get_document_service
        
        # 创建文档记录
        document_service = get_document_service()
        document_id = document_service.create_document(
            filename=filename,
            original_filename=original_filename,
            file_size=file_size,
            file_type=file_type,
            extracted_text=extracted_text,
            user_requirements=user_requirements
        )
        
        # 创建会话记录
        session_id = self.create_session(document_id)
        
        return document_id, session_id

    def create_session(self, document_id: str) -> str:
        """创建新的聊天会话"""
        session_id = str(uuid.uuid4())
        request_id = session_id[:8]

        logger.info(f"[{request_id}] Creating new chat session for document: {document_id}")

        try:
            with get_db() as db:
                # 检查文档是否存在
                document = db.query(Document).filter(Document.id == document_id).first()
                if not document:
                    raise ValueError(f"Document not found: {document_id}")

                # 创建数据库会话记录
                db_session = DBChatSession(
                    id=session_id,
                    document_id=document_id,
                    status=ChatSessionStatus.ACTIVE,
                    current_knowledge_points=[],
                    session_data={}
                )
                
                db.add(db_session)
                db.commit()
                db.refresh(db_session)

                # 会话创建成功，直接返回session_id

                logger.info(f"[{request_id}] Chat session created successfully")
                logger.info(f"[{request_id}] Session ID: {session_id}")

                return session_id
                
        except Exception as e:
            logger.error(f"[{request_id}] Failed to create chat session: {str(e)}")
            raise

    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """获取聊天会话"""
        # 直接从数据库加载
        session = self._load_session_from_db(session_id)

        if not session:
            logger.warning(f"Session not found: {session_id}")
            return None

        return session

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        reasoning: Optional[str] = None,
        message_type: str = "text",
        knowledge_points: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """添加消息到会话"""
        session = self.get_session(session_id)

        if not session:
            logger.error(f"Cannot add message - session not found: {session_id}")
            return False

        request_id = session_id[:8]

        message = ChatMessage(
            id=str(uuid.uuid4()),
            role=role,
            content=content,
            reasoning=reasoning,
            timestamp=datetime.now(timezone.utc),
            message_type=message_type,
            knowledge_points=knowledge_points
        )

        session.messages.append(message)
        session.last_activity = datetime.now(timezone.utc)

        # 保存消息到数据库
        self._save_message_to_db(session_id, message)

        # 如果是包含知识点的消息，更新当前知识点
        if knowledge_points:
            session.current_knowledge_points = knowledge_points
            self._update_knowledge_points_in_db(session_id, knowledge_points)
            logger.info(f"[{request_id}] Updated current knowledge points: {len(knowledge_points)} points")

        logger.info(f"[{request_id}] Added message to session - Role: {role}, Type: {message_type}")
        logger.debug(f"[{request_id}] Message content: {content[:100]}...")

        return True

    def get_messages(self, session_id: str) -> List[ChatMessage]:
        """获取会话的所有消息"""
        session = self.get_session(session_id)
        return session.messages if session else []

    def get_context_messages(self, session_id: str, max_messages: int = 10) -> List[Dict[str, Any]]:
        """获取会话上下文消息（用于AI调用）"""
        session = self.get_session(session_id)

        if not session:
            return []

        # 获取最近的消息作为上下文
        recent_messages = session.messages[-max_messages:] if len(session.messages) > max_messages else session.messages

        # 转换为AI服务需要的格式
        context_messages = []

        # 添加系统消息（文档内容）
        context_messages.append({
            "role": "system",
            "content": self._create_system_prompt(session)
        })

        # 添加历史对话
        for msg in recent_messages:
            if msg.role in ["user", "assistant"] and msg.message_type == "text":
                context_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        return context_messages

    def update_knowledge_points(self, session_id: str, knowledge_points: List[Dict[str, Any]]) -> bool:
        """更新会话的当前知识点"""
        session = self.get_session(session_id)

        if not session:
            logger.error(f"Cannot update knowledge points - session not found: {session_id}")
            return False

        request_id = session_id[:8]
        session.current_knowledge_points = knowledge_points
        session.last_activity = datetime.now()

        # 同时更新数据库
        self._update_knowledge_points_in_db(session_id, knowledge_points)

        logger.info(f"[{request_id}] Updated knowledge points: {len(knowledge_points)} points")

        return True

    def complete_session(self, session_id: str) -> bool:
        """标记会话为完成状态"""
        session = self.get_session(session_id)

        if not session:
            logger.error(f"Cannot complete session - session not found: {session_id}")
            return False

        request_id = session_id[:8]
        session.status = "completed"
        session.last_activity = datetime.now(timezone.utc)

        logger.info(f"[{request_id}] Session marked as completed")

        return True

    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        request_id = session_id[:8]

        try:
            with get_db() as db:
                # 删除会话记录（会级联删除关联的消息）
                db_session = db.query(DBChatSession).filter(DBChatSession.id == session_id).first()
                if db_session:
                    db.delete(db_session)
                    db.commit()
                    logger.info(f"[{request_id}] Session deleted from database")
                    return True
                else:
                    logger.warning(f"[{request_id}] Session not found in database: {session_id}")
                    return False

        except Exception as e:
            logger.error(f"[{request_id}] Failed to delete session from database: {str(e)}")
            return False

    def cleanup_expired_sessions(self) -> int:
        """清理过期的会话 - 已移除session_timeout逻辑，此方法现在返回0"""
        # 由于移除了session_timeout逻辑，此方法不再执行任何清理操作
        return 0

    def get_session_stats(self) -> Dict[str, Any]:
        """获取会话统计信息"""
        try:
            with get_db() as db:
                # 统计总会话数
                total_sessions = db.query(DBChatSession).count()

                # 统计活跃会话数
                active_sessions = db.query(DBChatSession).filter(
                    DBChatSession.status == ChatSessionStatus.ACTIVE
                ).count()

                # 统计已完成会话数
                completed_sessions = db.query(DBChatSession).filter(
                    DBChatSession.status == ChatSessionStatus.COMPLETED
                ).count()

                return {
                    "total_sessions": total_sessions,
                    "active_sessions": active_sessions,
                    "completed_sessions": completed_sessions
                }

        except Exception as e:
            logger.error(f"Failed to get session stats from database: {str(e)}")
            return {
                "total_sessions": 0,
                "active_sessions": 0,
                "completed_sessions": 0
            }


    def _create_system_prompt(self, session: ChatSession) -> str:
        """创建系统提示词"""
        # 根据文档内容和用户要求创建系统提示
        base_prompt = f"""你是一个数学知识专家，需要从给定的文档中智能提取数学知识点。

文档信息：
- 文件名：{session.filename}

文档内容：
{session.extracted_text[:8000]}  # 限制文档内容长度避免token超限

任务要求：
1. 分析文档内容，识别主要的数学知识点
2. 为每个知识点提取相关的例题和解答
3. 为知识点分配合适的分类和标签
4. 根据用户的对话来调整和完善知识点

输出格式：
当需要返回知识点时，使用以下JSON格式：
{{
  "knowledge_points": [
    {{
      "title": "知识点标题",
      "description": "知识点描述",
      "category": "分类",
      "examples": [
        {{
          "question": "题目",
          "solution": "解答",
          "difficulty": "easy|medium|hard"
        }}
      ],
      "tags": ["标签1", "标签2"]
    }}
  ]
}}

分类选项：sequence, algebra, geometry, calculus, statistics, linear-algebra, discrete-math, number-theory, general

你应该：
1. 首先展示你的思考过程
2. 然后提供知识点的提取结果
3. 根据用户的反馈来调整和改进结果
"""

        if session.user_requirements:
            base_prompt += f"\n\n用户特殊要求：\n{session.user_requirements}"

        return base_prompt

    def _save_message_to_db(self, session_id: str, message: ChatMessage) -> bool:
        """保存消息到数据库"""
        try:
            with get_db() as db:
                db_message = DBChatMessage(
                    id=message.id,
                    session_id=session_id,
                    role=message.role,
                    content=message.content,
                    reasoning=message.reasoning,
                    message_type=message.message_type,
                    knowledge_points=message.knowledge_points,
                    message_data={}
                )
                
                db.add(db_message)
                db.commit()
                return True
                
        except Exception as e:
            logger.error(f"Failed to save message to DB: {str(e)}")
            return False

    def _load_session_from_db(self, session_id: str) -> Optional[ChatSession]:
        """从数据库加载会话"""
        try:
            with get_db() as db:
                # 获取会话记录
                db_session = db.query(DBChatSession).filter(DBChatSession.id == session_id).first()
                if not db_session:
                    return None

                # 获取关联的文档
                document = db.query(Document).filter(Document.id == db_session.document_id).first()
                if not document:
                    logger.error(f"Document not found for session: {session_id}")
                    return None

                # 获取消息历史
                db_messages = db.query(DBChatMessage).filter(
                    DBChatMessage.session_id == session_id
                ).order_by(DBChatMessage.created_at).all()

                # 转换为内存对象
                messages = []
                for db_msg in db_messages:
                    msg = ChatMessage(
                        id=db_msg.id,
                        role=db_msg.role,
                        content=db_msg.content,
                        reasoning=db_msg.reasoning,
                        timestamp=db_msg.created_at,
                        message_type=db_msg.message_type,
                        knowledge_points=db_msg.knowledge_points
                    )
                    messages.append(msg)

                # 创建会话对象
                session = ChatSession(
                    session_id=session_id,
                    filename=document.filename,
                    extracted_text=document.extracted_text,
                    messages=messages,
                    current_knowledge_points=db_session.current_knowledge_points or [],
                    created_at=db_session.created_at,
                    last_activity=db_session.last_activity,
                    status=db_session.status.value,
                    user_requirements=document.user_requirements
                )

                logger.info(f"Loaded session from DB: {session_id}")
                return session
                
        except Exception as e:
            logger.error(f"Failed to load session from DB: {str(e)}")
            return None

    def _update_session_status_in_db(self, session_id: str, status: ChatSessionStatus) -> bool:
        """更新数据库中的会话状态"""
        try:
            with get_db() as db:
                db_session = db.query(DBChatSession).filter(DBChatSession.id == session_id).first()
                if db_session:
                    db_session.status = status
                    db_session.last_activity = datetime.now(timezone.utc)
                    db.commit()
                    return True
                return False
        except Exception as e:
            logger.error(f"Failed to update session status in DB: {str(e)}")
            return False

    def _update_knowledge_points_in_db(self, session_id: str, knowledge_points: List[Dict[str, Any]]) -> bool:
        """更新数据库中的知识点"""
        try:
            with get_db() as db:
                db_session = db.query(DBChatSession).filter(DBChatSession.id == session_id).first()
                if db_session:
                    db_session.current_knowledge_points = knowledge_points
                    db_session.last_activity = datetime.now(timezone.utc)
                    db.commit()
                    return True
                return False
        except Exception as e:
            logger.error(f"Failed to update knowledge points in DB: {str(e)}")
            return False


# 全局会话服务实例
_chat_session_service: Optional[ChatSessionService] = None


def get_chat_session_service() -> ChatSessionService:
    """获取聊天会话服务实例"""
    global _chat_session_service

    if _chat_session_service is None:
        _chat_session_service = ChatSessionService()

    return _chat_session_service