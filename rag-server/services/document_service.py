"""
文档管理服务
"""
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from models.document import Document, DocumentStatus, ChatSession as DBChatSession, ChatMessage as DBChatMessage
from models.base import get_db
from loguru import logger


class DocumentService:
    """文档管理服务"""

    def create_document(
        self,
        filename: str,
        original_filename: str,
        file_size: int,
        file_type: str,
        extracted_text: str,
        user_requirements: Optional[str] = None
    ) -> str:
        """创建新文档记录"""
        document_id = str(uuid.uuid4())
        request_id = document_id[:8]
        
        logger.info(f"[{request_id}] Creating document record")
        logger.info(f"[{request_id}] Filename: {filename}")
        logger.info(f"[{request_id}] File size: {file_size} bytes")
        logger.info(f"[{request_id}] File type: {file_type}")
        logger.info(f"[{request_id}] Text length: {len(extracted_text)} chars")

        try:
            with get_db() as db:
                # 创建文本预览
                text_preview = extracted_text[:2000] + ("..." if len(extracted_text) > 2000 else "")
                
                document = Document(
                    id=document_id,
                    filename=filename,
                    original_filename=original_filename,
                    file_size=file_size,
                    file_type=file_type,
                    extracted_text=extracted_text,
                    text_preview=text_preview,
                    status=DocumentStatus.PROCESSING,
                    user_requirements=user_requirements,
                    extra_data={}
                )
                
                db.add(document)
                db.commit()
                db.refresh(document)
                
                logger.info(f"[{request_id}] Document created successfully: {document_id}")
                return document_id
                
        except Exception as e:
            logger.error(f"[{request_id}] Failed to create document: {str(e)}")
            raise

    def get_document(self, document_id: str) -> Optional[Document]:
        """获取文档记录"""
        try:
            with get_db() as db:
                document = db.query(Document).filter(Document.id == document_id).first()
                return document
        except Exception as e:
            logger.error(f"Failed to get document {document_id}: {str(e)}")
            return None

    def update_document_status(
        self,
        document_id: str,
        status: DocumentStatus,
        error_message: Optional[str] = None
    ) -> bool:
        """更新文档状态"""
        request_id = document_id[:8]
        
        try:
            with get_db() as db:
                document = db.query(Document).filter(Document.id == document_id).first()
                
                if not document:
                    logger.error(f"[{request_id}] Document not found for status update")
                    return False
                
                document.status = status
                if error_message:
                    document.error_message = error_message
                document.updated_at = datetime.now(timezone.utc)
                
                db.commit()
                
                logger.info(f"[{request_id}] Document status updated to: {status}")
                return True
                
        except Exception as e:
            logger.error(f"[{request_id}] Failed to update document status: {str(e)}")
            return False

    def get_documents(
        self,
        limit: int = 20,
        offset: int = 0,
        status: Optional[DocumentStatus] = None
    ) -> List[Document]:
        """获取文档列表"""
        try:
            with get_db() as db:
                query = db.query(Document)
                
                if status:
                    query = query.filter(Document.status == status)
                
                documents = query.order_by(desc(Document.created_at)).offset(offset).limit(limit).all()
                return documents
                
        except Exception as e:
            logger.error(f"Failed to get documents: {str(e)}")
            return []

    def delete_document(self, document_id: str) -> bool:
        """删除文档记录"""
        request_id = document_id[:8]
        
        try:
            with get_db() as db:
                document = db.query(Document).filter(Document.id == document_id).first()
                
                if not document:
                    logger.error(f"[{request_id}] Document not found for deletion")
                    return False
                
                db.delete(document)
                db.commit()
                
                logger.info(f"[{request_id}] Document deleted successfully")
                return True
                
        except Exception as e:
            logger.error(f"[{request_id}] Failed to delete document: {str(e)}")
            return False

    def get_document_sessions(self, document_id: str) -> List[DBChatSession]:
        """获取文档的所有聊天会话"""
        try:
            with get_db() as db:
                sessions = db.query(DBChatSession).filter(
                    DBChatSession.document_id == document_id
                ).order_by(desc(DBChatSession.created_at)).all()
                return sessions
                
        except Exception as e:
            logger.error(f"Failed to get document sessions: {str(e)}")
            return []

    def get_document_count(self, status: Optional[DocumentStatus] = None) -> int:
        """获取文档总数"""
        try:
            with get_db() as db:
                query = db.query(Document)
                
                if status:
                    query = query.filter(Document.status == status)
                
                return query.count()
                
        except Exception as e:
            logger.error(f"Failed to get document count: {str(e)}")
            return 0


# 全局文档服务实例
_document_service: Optional[DocumentService] = None


def get_document_service() -> DocumentService:
    """获取文档服务实例"""
    global _document_service
    
    if _document_service is None:
        _document_service = DocumentService()
    
    return _document_service
