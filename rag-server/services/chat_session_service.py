"""
文档解析聊天会话管理服务
"""
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
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
    max_documents: int = 10
    user_requirements: Optional[str] = None


class ChatSessionService:
    """聊天会话管理服务"""

    def __init__(self):
        # 内存存储，生产环境可以考虑使用Redis
        self.sessions: Dict[str, ChatSession] = {}
        self.session_timeout = timedelta(hours=2)  # 会话超时时间

    def create_session(
        self,
        filename: str,
        extracted_text: str,
        max_documents: int = 10,
        user_requirements: Optional[str] = None
    ) -> str:
        """创建新的聊天会话"""
        session_id = str(uuid.uuid4())
        request_id = session_id[:8]

        logger.info(f"[{request_id}] Creating new chat session")
        logger.info(f"[{request_id}] Filename: {filename}")
        logger.info(f"[{request_id}] Extracted text length: {len(extracted_text)} characters")
        logger.info(f"[{request_id}] Max documents: {max_documents}")
        logger.info(f"[{request_id}] User requirements: {user_requirements or 'None'}")

        session = ChatSession(
            session_id=session_id,
            filename=filename,
            extracted_text=extracted_text,
            created_at=datetime.now(),
            last_activity=datetime.now(),
            max_documents=max_documents,
            user_requirements=user_requirements
        )

        # 添加系统消息
        system_message = ChatMessage(
            id=str(uuid.uuid4()),
            role="system",
            content=f"开始解析文档：{filename}",
            timestamp=datetime.now(),
            message_type="text"
        )
        session.messages.append(system_message)

        self.sessions[session_id] = session

        logger.info(f"[{request_id}] Chat session created successfully")
        logger.info(f"[{request_id}] Session ID: {session_id}")

        return session_id

    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """获取聊天会话"""
        session = self.sessions.get(session_id)

        if not session:
            logger.warning(f"Session not found: {session_id}")
            return None

        # 检查会话是否过期
        if self._is_session_expired(session):
            logger.warning(f"Session expired: {session_id}")
            session.status = "expired"
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
            timestamp=datetime.now(),
            message_type=message_type,
            knowledge_points=knowledge_points
        )

        session.messages.append(message)
        session.last_activity = datetime.now()

        # 如果是包含知识点的消息，更新当前知识点
        if knowledge_points:
            session.current_knowledge_points = knowledge_points
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
        session.last_activity = datetime.now()

        logger.info(f"[{request_id}] Session marked as completed")

        return True

    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        if session_id in self.sessions:
            request_id = session_id[:8]
            del self.sessions[session_id]
            logger.info(f"[{request_id}] Session deleted")
            return True

        logger.warning(f"Cannot delete session - session not found: {session_id}")
        return False

    def cleanup_expired_sessions(self) -> int:
        """清理过期的会话"""
        expired_sessions = []

        for session_id, session in self.sessions.items():
            if self._is_session_expired(session):
                expired_sessions.append(session_id)

        for session_id in expired_sessions:
            del self.sessions[session_id]

        if expired_sessions:
            logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")

        return len(expired_sessions)

    def get_session_stats(self) -> Dict[str, Any]:
        """获取会话统计信息"""
        total_sessions = len(self.sessions)
        active_sessions = len([s for s in self.sessions.values() if s.status == "active"])
        completed_sessions = len([s for s in self.sessions.values() if s.status == "completed"])

        return {
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "completed_sessions": completed_sessions,
            "expired_sessions": total_sessions - active_sessions - completed_sessions
        }

    def _is_session_expired(self, session: ChatSession) -> bool:
        """检查会话是否过期"""
        return datetime.now() - session.last_activity > self.session_timeout

    def _create_system_prompt(self, session: ChatSession) -> str:
        """创建系统提示词"""
        # 根据文档内容和用户要求创建系统提示
        base_prompt = f"""你是一个数学知识专家，需要从给定的文档中智能提取数学知识点。

文档信息：
- 文件名：{session.filename}
- 最大知识点数量：{session.max_documents}

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


# 全局会话服务实例
_chat_session_service: Optional[ChatSessionService] = None


def get_chat_session_service() -> ChatSessionService:
    """获取聊天会话服务实例"""
    global _chat_session_service

    if _chat_session_service is None:
        _chat_session_service = ChatSessionService()

    return _chat_session_service