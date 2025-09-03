"""
FastAPI 路由定义
"""
from datetime import datetime
import json
import traceback
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query
from fastapi.responses import JSONResponse
import logging

from schemas.embeddings import (
    DocumentsAddRequest, ExampleInput, KnowledgePointAddRequest, QueryRequest, QueryResponse, 
    CollectionInfo, KnowledgePointInput, KnowledgePointResponse, 
    KnowledgePointsResponse
)
from schemas.common import HealthCheck, ErrorResponse
from services.rag_service import rag_service

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()


@router.post(
    "/knowledge-points",
    response_model=KnowledgePointResponse,
    status_code=status.HTTP_201_CREATED,
    summary="添加知识点",
    description="添加数学知识点及相关例题"
)
async def add_knowledge_point(request: KnowledgePointAddRequest):
    """
    添加知识点到知识库
    
    - **knowledge_point**: 知识点信息，包含名称、描述、例题等
    """
    try:
        import uuid
        from datetime import datetime
        from schemas.embeddings import DocumentInput
        
        knowledge_point = request.knowledge_point
        
        # 生成知识点ID
        knowledge_id = str(uuid.uuid4())
        
        # 准备文档内容 - 主要用于向量搜索
        content_parts = [
            f"知识点: {knowledge_point.title}",
            f"描述: {knowledge_point.description}",
            f"分类: {knowledge_point.category or 'general'}"
        ]
        
        # 添加例题到内容中用于向量搜索
        for i, example in enumerate(knowledge_point.examples, 1):
            content_parts.extend([
                f"例题{i}: {example.question}",
                f"解答步骤: {example.solution}"
            ])
        
        if knowledge_point.tags:
            content_parts.append(f"标签: {', '.join(knowledge_point.tags)}")
        
        document_content = "\n".join(content_parts)
        
        # 准备元数据 - 存储完整的结构化数据（序列化复杂类型）
        examples_data = [
            {
                "question": ex.question,
                "solution": ex.solution,
                "difficulty": ex.difficulty
            } for ex in knowledge_point.examples
        ]
        
        current_time = datetime.now().isoformat()
        metadata = {
            "type": "knowledge_point",
            "title": knowledge_point.title,
            "description": knowledge_point.description,
            "category": knowledge_point.category or "general",
            "tags": json.dumps(knowledge_point.tags or [], ensure_ascii=False),  # 序列化为JSON字符串
            "examples": json.dumps(examples_data, ensure_ascii=False),  # 序列化为JSON字符串
            "examples_count": len(knowledge_point.examples),
            "created_at": current_time,
            "updated_at": current_time
        }
        
        # 创建文档
        document = DocumentInput(
            id=knowledge_id,
            content=document_content,
            metadata=metadata
        )
        
        # 添加到向量数据库
        success = await rag_service.add_documents(
            documents=[document],
            collection_name="math_knowledge"
        )
        
        if success:
            # 返回知识点信息（反序列化JSON数据）
            return KnowledgePointResponse(
                id=knowledge_id,
                title=metadata["title"],
                description=metadata["description"],
                category=metadata["category"],
                examples=examples_data,  # 直接使用原始数据
                tags=knowledge_point.tags or [],  # 直接使用原始数据
                created_at=metadata["created_at"],
                updated_at=metadata["updated_at"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="添加知识点失败"
            )
            
    except Exception as e:
        logger.error(f"添加知识点接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"添加知识点失败: {str(e)}"
        )


@router.post(
    "/query",
    response_model=QueryResponse,
    summary="查询文档",
    description="根据查询文本检索相关文档"
)
async def query_documents(request: QueryRequest):
    """
    查询相关文档
    
    - **query**: 查询文本
    - **n_results**: 返回结果数量，默认为 5，范围 1-20
    - **include_metadata**: 是否包含元数据，默认为 True
    """
    try:
        response = await rag_service.query_documents(
            query=request.query,
            collection_name="math_knowledge",
            n_results=request.n_results,
            include_metadata=request.include_metadata
        )
        
        return response
        
    except Exception as e:
        logger.error(f"查询文档接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询文档失败: {str(e)}"
        )


@router.get(
    "/collections/{collection_name}",
    response_model=CollectionInfo,
    summary="获取集合信息",
    description="获取指定集合的信息"
)
async def get_collection_info(collection_name: str):
    """
    获取集合信息
    
    - **collection_name**: 集合名称
    """
    try:
        info = await rag_service.get_collection_info(collection_name)
        return CollectionInfo(**info)
        
    except Exception as e:
        logger.error(f"获取集合信息接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取集合信息失败: {str(e)}"
        )


@router.get(
    "/knowledge-points",
    response_model=KnowledgePointsResponse,
    summary="获取知识点列表",
    description="分页获取知识点列表"
)
async def get_knowledge_points(
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(20, ge=1, le=100, description="每页数量"),
    category: Optional[str] = Query(None, description="分类筛选"),
    search: Optional[str] = Query(None, description="搜索关键词")
):
    """
    获取知识点列表
    
    - **page**: 页码，从1开始
    - **limit**: 每页数量，默认20
    - **category**: 分类筛选
    - **search**: 搜索关键词
    """
    try:
        # 构建查询条件
        query_text = search if search else "知识点"
        
        # 查询文档
        response = await rag_service.query_documents(
            query=query_text,
            collection_name="math_knowledge",
            n_results=min(limit * 5, 100),  # 获取更多结果用于筛选
            include_metadata=True
        )
        
        # 筛选知识点类型的文档
        knowledge_points = []
        for doc in response.results:
            if (doc.metadata and 
                doc.metadata.get("type") == "knowledge_point"):
                
                # 分类筛选
                if category and doc.metadata.get("category") != category:
                    continue
                
                # 从metadata中获取结构化数据，反序列化JSON字段
                try:
                    examples = json.loads(doc.metadata.get("examples", "[]"))
                except (json.JSONDecodeError, TypeError):
                    examples = []
                
                try:
                    tags = json.loads(doc.metadata.get("tags", "[]"))
                except (json.JSONDecodeError, TypeError):
                    tags = []
                
                knowledge_point = KnowledgePointResponse(
                    id=doc.id,
                    title=doc.metadata.get("title", "未知知识点"),
                    description=doc.metadata.get("description", ""),
                    category=doc.metadata.get("category", "general"),
                    examples=examples,
                    tags=tags,
                    created_at=doc.metadata.get("created_at"),
                    updated_at=doc.metadata.get("updated_at")
                )
                knowledge_points.append(knowledge_point)
        
        # 分页处理
        start = (page - 1) * limit
        end = start + limit
        paginated_points = knowledge_points[start:end]
        
        return KnowledgePointsResponse(
            knowledge_points=paginated_points,
            total=len(knowledge_points),
            page=page,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"获取知识点列表接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取知识点列表失败: {str(e)}"
        )


@router.post(
    "/clear",
    response_model=dict,
    summary="清空知识库",
    description="清空所有知识点数据"
)
async def clear_knowledge_base():
    """
    清空知识库
    
    注意：此操作会删除所有知识点数据，不可恢复
    """
    try:
        success = await rag_service.clear_knowledge_base()
        
        if success:
            return {
                "message": "知识库清空成功",
                "status": "success"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="清空知识库失败"
            )
            
    except Exception as e:
        logger.error(f"清空知识库接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"清空知识库失败: {str(e)}"
        )


@router.get(
    "/knowledge-points/{knowledge_id}",
    response_model=KnowledgePointResponse,
    summary="获取知识点详情",
    description="根据ID获取指定知识点的详细信息"
)
async def get_knowledge_point(knowledge_id: str):
    """
    获取知识点详情
    
    - **knowledge_id**: 知识点ID
    """
    try:
        # 通过ID查询知识点
        result = await rag_service.query_documents(
            query=knowledge_id,  # 使用ID作为查询
            n_results=1000,  # 获取更多结果
            collection_name="math_knowledge"
        )
        
        if not result or not result.results or len(result.results) == 0:
            raise HTTPException(status_code=404, detail="知识点不存在")
        
        # 查找匹配的ID
        target_result = None
        for doc_result in result.results:
            if doc_result.id == knowledge_id:
                target_result = doc_result
                break
        
        if target_result is None:
            raise HTTPException(status_code=404, detail="知识点不存在")
        
        # 获取知识点数据
        metadata = target_result.metadata or {}
        document = target_result.content
        
        # 反序列化JSON字段
        tags = json.loads(metadata.get("tags", "[]"))
        examples_data = json.loads(metadata.get("examples", "[]"))
        
        return KnowledgePointResponse(
            id=knowledge_id,
            title=metadata.get("title", ""),
            description=metadata.get("description", ""),  # 使用metadata中的原始description
            category=metadata.get("category", "general"),
            examples=examples_data,  # 直接使用字典列表
            tags=tags,
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取知识点详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取知识点详情失败: {str(e)}")

@router.put(
    "/knowledge-points/{knowledge_id}",
    response_model=KnowledgePointResponse,
    summary="更新知识点",
    description="更新指定ID的知识点"
)
async def update_knowledge_point(knowledge_id: str, request: KnowledgePointAddRequest):
    """
    更新知识点
    
    - **knowledge_id**: 知识点ID
    - **request**: 更新的知识点数据
    """
    try:
        from schemas.embeddings import DocumentInput
        
        knowledge_point = request.knowledge_point
        
        # 获取原有知识点的创建时间
        existing_created_at = None
        try:
            # 查询现有知识点获取创建时间
            existing_result = await rag_service.query_documents(
                query=knowledge_id,
                n_results=1000,
                collection_name="math_knowledge"
            )
            
            # 查找匹配的ID
            for doc_result in existing_result.results:
                if doc_result.id == knowledge_id and doc_result.metadata:
                    existing_created_at = doc_result.metadata.get("created_at")
                    break
        except Exception as e:
            logger.warning(f"无法获取原有创建时间: {e}")
            # 如果无法获取原有时间，使用当前时间作为创建时间
            existing_created_at = datetime.now().isoformat()
        
        # 准备文档内容 - 主要用于向量搜索
        content_parts = [
            f"知识点: {knowledge_point.title}",
            f"描述: {knowledge_point.description}",
            f"分类: {knowledge_point.category or 'general'}"
        ]
        
        # 添加例题到内容中用于向量搜索
        for i, example in enumerate(knowledge_point.examples, 1):
            content_parts.extend([
                f"例题{i}: {example.question}",
                f"解答步骤: {example.solution}"
            ])
        
        if knowledge_point.tags:
            content_parts.append(f"标签: {', '.join(knowledge_point.tags)}")
        
        document_content = "\n".join(content_parts)
        
        # 准备元数据 - 存储完整的结构化数据（序列化复杂类型）
        examples_data = [
            {
                "question": ex.question,
                "solution": ex.solution,
                "difficulty": ex.difficulty
            } for ex in knowledge_point.examples
        ]
        
        metadata = {
            "type": "knowledge_point",
            "title": knowledge_point.title,
            "description": knowledge_point.description,
            "category": knowledge_point.category or "general",
            "tags": json.dumps(knowledge_point.tags or [], ensure_ascii=False),  # 序列化为JSON字符串
            "examples": json.dumps(examples_data, ensure_ascii=False),  # 序列化为JSON字符串
            "examples_count": len(knowledge_point.examples),
            "created_at": existing_created_at or datetime.now().isoformat(),  # 保留原有创建时间
            "updated_at": datetime.now().isoformat()
        }
        
        # 创建文档
        document = DocumentInput(
            id=knowledge_id,
            content=document_content,
            metadata=metadata
        )
        
        # 使用 upsert 更新或插入文档
        success = await rag_service.upsert_documents(
            documents=[document],
            collection_name="math_knowledge"
        )
        
        if success:
            # 返回知识点信息（反序列化JSON数据）
            return KnowledgePointResponse(
                id=knowledge_id,
                title=metadata["title"],
                description=knowledge_point.description,  # 使用原始的description
                category=metadata["category"],
                examples=examples_data,  # 直接使用原始数据
                tags=knowledge_point.tags or [],  # 直接使用原始数据
                created_at=metadata["created_at"],
                updated_at=metadata["updated_at"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="更新知识点失败"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新知识点失败: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"更新知识点失败: {str(e)}")


@router.delete(
    "/knowledge-points/{knowledge_id}",
    response_model=dict,
    summary="删除知识点",
    description="根据ID删除知识点"
)
async def delete_knowledge_point(knowledge_id: str):
    """
    删除知识点
    
    - **knowledge_id**: 知识点ID
    """
    try:
        success = await rag_service.delete_documents(
            ids=[knowledge_id],
            collection_name="math_knowledge"
        )
        
        if success:
            return {
                "message": "知识点删除成功",
                "knowledge_id": knowledge_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="删除知识点失败"
            )
            
    except Exception as e:
        logger.error(f"删除知识点接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除知识点失败: {str(e)}"
        )

