"""
文档管理API路由
"""
from datetime import datetime
import json
import traceback
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import logging

from services.document_service import get_document_service
from services.chat_session_service import get_chat_session_service
from models.document import DocumentStatus, ChatSessionStatus
from loguru import logger
import uuid


# 创建路由器
router = APIRouter()


class DocumentResponse(BaseModel):
    """文档响应模型"""
    id: str
    filename: str
    original_filename: str
    file_size: int
    file_type: str
    status: str
    created_at: str
    updated_at: str
    text_preview: Optional[str] = None
    user_requirements: Optional[str] = None


class DocumentListResponse(BaseModel):
    """文档列表响应模型"""
    documents: List[DocumentResponse]
    total: int
    page: int
    limit: int


class ChatSessionResponse(BaseModel):
    """聊天会话响应模型"""
    id: str
    document_id: str
    status: str
    created_at: str
    last_activity: str
    current_knowledge_points: List[Dict[str, Any]]


@router.get(
    "/",
    response_model=DocumentListResponse,
    summary="获取文档列表",
    description="分页获取文档列表"
)
async def get_documents(
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(20, ge=1, le=100, description="每页数量"),
    status: Optional[str] = Query(None, description="状态筛选")
):
    """
    获取文档列表
    
    - **page**: 页码，从1开始
    - **limit**: 每页数量，默认20
    - **status**: 状态筛选（uploading/processing/completed/failed）
    """
    try:
        document_service = get_document_service()
        
        # 计算偏移量
        offset = (page - 1) * limit
        
        # 状态筛选
        status_filter = None
        if status:
            try:
                status_filter = DocumentStatus(status)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"无效的状态值: {status}"
                )
        
        # 获取文档列表
        documents = document_service.get_documents(
            limit=limit,
            offset=offset,
            status=status_filter
        )
        
        # 获取总数
        total_count = document_service.get_document_count(status=status_filter)
        
        # 转换为响应格式
        document_responses = []
        for doc in documents:
            doc_response = DocumentResponse(
                id=doc.id,
                filename=doc.filename,
                original_filename=doc.original_filename,
                file_size=doc.file_size,
                file_type=doc.file_type,
                status=doc.status.value,
                created_at=doc.created_at.isoformat(),
                updated_at=doc.updated_at.isoformat(),
                text_preview=doc.text_preview,
                user_requirements=doc.user_requirements
            )
            document_responses.append(doc_response)
        
        return DocumentListResponse(
            documents=document_responses,
            total=total_count,
            page=page,
            limit=limit
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档列表失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文档列表失败: {str(e)}"
        )


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="获取文档详情",
    description="根据ID获取文档详细信息"
)
async def get_document(document_id: str):
    """
    获取文档详情
    
    - **document_id**: 文档ID
    """
    try:
        document_service = get_document_service()
        document = document_service.get_document(document_id)
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文档不存在"
            )
        
        return DocumentResponse(
            id=document.id,
            filename=document.filename,
            original_filename=document.original_filename,
            file_size=document.file_size,
            file_type=document.file_type,
            status=document.status.value,
            created_at=document.created_at.isoformat(),
            updated_at=document.updated_at.isoformat(),
            text_preview=document.text_preview,
            user_requirements=document.user_requirements
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文档详情失败: {str(e)}"
        )


@router.get(
    "/{document_id}/sessions",
    response_model=List[ChatSessionResponse],
    summary="获取文档的聊天会话列表",
    description="获取指定文档的所有聊天会话"
)
async def get_document_sessions(document_id: str):
    """
    获取文档的聊天会话列表
    
    - **document_id**: 文档ID
    """
    try:
        # 先检查文档是否存在
        document_service = get_document_service()
        document = document_service.get_document(document_id)
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文档不存在"
            )
        
        # 获取会话列表（这里需要添加到document_service中）
        sessions = document_service.get_document_sessions(document_id)
        
        # 转换为响应格式
        session_responses = []
        for session in sessions:
            session_response = ChatSessionResponse(
                id=session.id,
                document_id=session.document_id,
                status=session.status.value,
                created_at=session.created_at.isoformat(),
                last_activity=session.last_activity.isoformat(),
                current_knowledge_points=session.current_knowledge_points or []
            )
            session_responses.append(session_response)
        
        return session_responses
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档会话列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文档会话列表失败: {str(e)}"
        )


@router.get(
    "/{document_id}/full-text",
    summary="获取文档完整文本",
    description="获取文档的完整提取文本"
)
async def get_document_full_text(document_id: str):
    """
    获取文档完整文本
    
    - **document_id**: 文档ID
    """
    try:
        document_service = get_document_service()
        document = document_service.get_document(document_id)
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文档不存在"
            )
        
        return {
            "document_id": document.id,
            "filename": document.filename,
            "extracted_text": document.extracted_text,
            "text_length": len(document.extracted_text)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档完整文本失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文档完整文本失败: {str(e)}"
        )


@router.delete(
    "/{document_id}",
    response_model=dict,
    summary="删除文档",
    description="删除指定文档及其关联的会话和消息"
)
async def delete_document(document_id: str):
    """
    删除文档
    
    - **document_id**: 文档ID
    """
    try:
        document_service = get_document_service()
        
        # 检查文档是否存在
        document = document_service.get_document(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文档不存在"
            )
        
        # 删除文档（会级联删除相关会话和消息）
        success = document_service.delete_document(document_id)
        
        if success:
            return {
                "message": "文档删除成功",
                "document_id": document_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="删除文档失败"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除文档失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除文档失败: {str(e)}"
        )
