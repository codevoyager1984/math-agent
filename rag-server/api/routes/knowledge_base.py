"""
FastAPI 路由定义
"""
from datetime import datetime
import json
import traceback
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query, File, UploadFile
from fastapi.responses import JSONResponse
import logging

from schemas.embeddings import (
    DocumentsAddRequest, ExampleInput, KnowledgePointAddRequest, QueryRequest, QueryResponse,
    CollectionInfo, AddDocumentInput, KnowledgePointResponse,
    KnowledgePointsResponse, DocumentParseRequest, DocumentParseResponse,
    BatchKnowledgePointsRequest, BatchKnowledgePointsResponse
)
from schemas.common import HealthCheck, ErrorResponse
from services.rag_service import rag_service
# 文档处理相关接口
from services.document_processor import document_processor
from services.ai_service import get_ai_service
from loguru import logger
import uuid
from datetime import datetime
from schemas.embeddings import DocumentInput

# 创建路由器
router = APIRouter()

@router.post(
    "/documents",
    response_model=KnowledgePointResponse,
    status_code=status.HTTP_201_CREATED,
    summary="添加知识点",
    description="往知识库里面添加文档"
)
async def add_document(request: AddDocumentInput):
    try:
        
        # 生成知识点ID
        knowledge_id = str(uuid.uuid4())

        title = request.title
        description = request.description
        category = request.category or 'general'
        examples = request.examples
        tags = request.tags
        
        # 准备文档内容 - 主要用于向量搜索
        content_parts = [
            f"知识点: {title}",
            f"描述: {description}",
            f"分类: {category}"
        ]
        
        # 添加例题到内容中用于向量搜索
        for i, example in enumerate(examples, 1):
            content_parts.extend([
                f"例题{i}: {example.question}",
                f"解答步骤: {example.solution}"
            ])
        
        if tags:
            content_parts.append(f"标签: {', '.join(tags)}")
        
        document_content = "\n".join(content_parts)

        logger.info(f"Embedding content: {document_content}")
        
        # 准备元数据 - 存储完整的结构化数据（序列化复杂类型）
        examples_data = [
            {
                "question": ex.question,
                "solution": ex.solution,
                "difficulty": ex.difficulty
            } for ex in examples
        ]
        
        current_time = datetime.now().isoformat()
        metadata = {
            "title": title,
            "description": description,
            "category": category,
            "tags": json.dumps(tags or [], ensure_ascii=False),  # 序列化为JSON字符串
            "examples": json.dumps(examples_data, ensure_ascii=False),  # 序列化为JSON字符串
            "examples_count": len(examples),
            "created_at": current_time,
            "updated_at": current_time
        }

        logger.info(f"Metadata: {metadata}")
        
        # 创建文档
        document = DocumentInput(
            id=knowledge_id,
            content=document_content,
            metadata=metadata
        )
        
        # 添加到双重存储系统（ChromaDB + Elasticsearch）
        success = await rag_service.add_documents(
            documents=[document],
            request_id=knowledge_id[:8]  # 使用知识点ID的前8位作为请求ID
        )
        
        if success:
            # 返回知识点信息（反序列化JSON数据）
            return KnowledgePointResponse(
                id=knowledge_id,
                title=title,
                description=description,
                category=category,
                examples=examples_data,  # 直接使用原始数据
                tags=tags or [],  # 直接使用原始数据
                created_at=current_time,
                updated_at=current_time
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
    summary="智能查询文档",
    description="支持向量搜索、文本搜索、混合搜索和重排序的智能查询"
)
async def query_documents(request: QueryRequest):
    """
    智能查询相关文档

    - **query**: 查询文本
    - **n_results**: 返回结果数量，默认为 5，范围 1-20
    - **include_metadata**: 是否包含元数据，默认为 True
    - **search_mode**: 搜索模式 (vector/text/hybrid)，默认为 vector
    - **vector_weight**: 向量搜索权重，默认为 0.6
    - **text_weight**: 文本搜索权重，默认为 0.4
    - **enable_rerank**: 是否启用重排序，默认为 False
    - **rerank_top_k**: 重排序后返回的top结果数量
    """
    # 生成请求ID用于追踪
    request_id = str(uuid.uuid4())[:8]

    try:
        logger.info(f"[{request_id}] Query request - mode: {request.search_mode}, query: '{request.query[:50]}...'")

        response = await rag_service.smart_query_documents(
            request=request,
            request_id=request_id
        )

        logger.info(f"[{request_id}] Query completed - {len(response.results)} results")
        return response

    except Exception as e:
        logger.error(f"[{request_id}] Query failed: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询文档失败: {str(e)}"
        )



@router.get(
    "/info",
    response_model=CollectionInfo,
    summary="获取集合信息",
    description="获取指定集合的信息"
)
async def get_collection_info():
    """
    获取集合信息
    
    - **collection_name**: 集合名称
    """
    try:
        info = await rag_service.get_collection_info()
        return CollectionInfo(**info)
        
    except Exception as e:
        logger.error(f"获取集合信息接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取集合信息失败: {str(e)}"
        )


@router.get(
    "/documents",
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
        # 查询文档
        response = await rag_service.query_documents(
            query=search,
            n_results=min(limit * 5, 100),  # 获取更多结果用于筛选
            include_metadata=True
        )
        
        # 筛选知识点类型的文档
        knowledge_points = []
        for doc in response.results:
            if (doc.metadata):
                
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
                    title=doc.metadata.get("title"),
                    description=doc.metadata.get("description"),
                    category=doc.metadata.get("category"),
                    examples=examples,
                    tags=tags,
                    created_at=doc.metadata.get("created_at"),
                    updated_at=doc.metadata.get("updated_at")
                )
                knowledge_points.append(knowledge_point)
        
        # 按照创建时间从新到旧排序
        knowledge_points.sort(
            key=lambda kp: kp.created_at,
            reverse=True
        )
        
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
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取知识点列表失败: {str(e)}"
        )


@router.post(
    "/delete-all",
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
        success = await rag_service.clear_knowledge_base(
            request_id=str(uuid.uuid4())[:8]
        )
        
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
    "/documents/{document_id}",
    response_model=KnowledgePointResponse,
    summary="获取知识点详情",
    description="根据ID获取指定知识点的详细信息"
)
async def get_knowledge_point(document_id: str):
    """
    获取知识点详情

    - **knowledge_id**: 知识点ID
    """
    try:
        # 直接通过ID获取文档
        result = await rag_service.get_document_by_id(
            document_id=document_id,
            request_id=document_id[:8]  # 使用文档ID的前8位作为请求ID
        )

        if not result:
            raise HTTPException(status_code=404, detail="知识点不存在")

        # 获取知识点数据
        metadata = result.metadata or {}

        # 反序列化JSON字段
        try:
            tags = json.loads(metadata.get("tags", "[]"))
        except (json.JSONDecodeError, TypeError):
            tags = []

        try:
            examples_data = json.loads(metadata.get("examples", "[]"))
        except (json.JSONDecodeError, TypeError):
            examples_data = []

        return KnowledgePointResponse(
            id=document_id,
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
    "/documents/{document_id}",
    response_model=KnowledgePointResponse,
    summary="更新知识点",
    description="更新指定ID的知识点"
)
async def update_knowledge_point(document_id: str, request: KnowledgePointAddRequest):
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
            # 直接通过ID获取现有知识点
            existing_doc = await rag_service.get_document_by_id(
                document_id=document_id,
                request_id=document_id[:8]
            )

            if existing_doc and existing_doc.metadata:
                existing_created_at = existing_doc.metadata.get("created_at")
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
            id=document_id,
            content=document_content,
            metadata=metadata
        )
        
        # 使用 upsert 更新或插入文档到双重存储系统
        success = await rag_service.upsert_documents(
            documents=[document],
            request_id=document_id[:8]  # 使用文档ID的前8位作为请求ID
        )
        
        if success:
            # 返回知识点信息（反序列化JSON数据）
            return KnowledgePointResponse(
                id=document_id,
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
    "/documents/{document_id}",
    response_model=dict,
    summary="删除知识点",
    description="根据ID删除知识点"
)
async def delete_knowledge_point(document_id: str):
    """
    删除知识点
    
    - **knowledge_id**: 知识点ID
    """
    try:
        success = await rag_service.delete_documents(
            ids=[document_id],
            request_id=document_id[:8]  # 使用文档ID的前8位作为请求ID
        )
        
        if success:
            return {
                "message": "知识点删除成功",
                "knowledge_id": document_id
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


@router.post(
    "/upload-document",
    response_model=DocumentParseResponse,
    summary="解析文档生成知识点",
    description="上传文档并解析生成知识点预览"
)
async def parse_document(
    file: UploadFile = File(...),
    max_documents: int = Query(10, ge=1, le=20, description="最大文档数量")
):
    """
    解析文档生成知识点预览
    
    - **file**: 上传的文档文件（支持 PDF, DOCX, TXT, MD 格式）
    - **max_documents**: 最大生成文档数量
    """
    # Generate request ID for tracking the entire flow
    import uuid
    import time
    
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()
    
    logger.info(f"[{request_id}] Document parsing request started")
    logger.info(f"[{request_id}] File: {file.filename}, Content-Type: {file.content_type}")
    logger.info(f"[{request_id}] Max documents: {max_documents}")
    
    try:
        # 检查文件类型
        logger.debug(f"[{request_id}] Validating file format")
        if not document_processor.is_supported_file(file.filename):
            logger.warning(f"[{request_id}] Unsupported file format: {file.filename}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件格式。支持的格式：{', '.join(document_processor.SUPPORTED_EXTENSIONS.keys())}"
            )
        
        file_type = document_processor.get_file_type(file.filename)
        logger.info(f"[{request_id}] File format validated: {file_type}")
        
        # 检查文件大小（限制为 10MB）
        logger.debug(f"[{request_id}] Reading file content")
        max_file_size = 10 * 1024 * 1024  # 10MB
        file_read_start = time.time()
        file_content = await file.read()
        file_read_time = time.time() - file_read_start
        
        file_size_mb = len(file_content) / 1024 / 1024
        logger.info(f"[{request_id}] File read completed in {file_read_time:.3f}s")
        logger.info(f"[{request_id}] File size: {file_size_mb:.2f}MB ({len(file_content)} bytes)")
        
        if len(file_content) > max_file_size:
            logger.warning(f"[{request_id}] File too large: {file_size_mb:.2f}MB > 10MB")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件大小超过限制（最大 10MB）"
            )
        
        # 提取文档文本
        logger.info(f"[{request_id}] Starting text extraction from document")
        text_extract_start = time.time()
        extracted_text = await document_processor.process_file_content(file_content, file.filename)
        text_extract_time = time.time() - text_extract_start
        
        logger.info(f"[{request_id}] Text extraction completed in {text_extract_time:.3f}s")
        logger.info(f"[{request_id}] Extracted text length: {len(extracted_text)} characters")
        
        if not extracted_text.strip():
            logger.error(f"[{request_id}] No valid text content extracted from document")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无法从文档中提取有效文本内容"
            )
        
        # 使用 AI 生成知识点
        logger.info(f"[{request_id}] Starting AI knowledge point generation")
        ai_start = time.time()
        ai_service = get_ai_service()
        knowledge_points_data = await ai_service.generate_knowledge_points(
            extracted_text, 
            max_points=max_documents
        )
        ai_time = time.time() - ai_start
        logger.info(f"[{request_id}] AI processing completed in {ai_time:.3f}s")
        
        # 转换为响应格式
        logger.debug(f"[{request_id}] Converting to response format")
        conversion_start = time.time()
        knowledge_points = []
        
        for i, kp_data in enumerate(knowledge_points_data):
            logger.debug(f"[{request_id}] Converting knowledge point {i+1}/{len(knowledge_points_data)}")
            
            examples = [
                {
                    "question": ex.question,
                    "solution": ex.solution,
                    "difficulty": ex.difficulty
                } 
                for ex in kp_data.examples
            ]
            
            kp_input = AddDocumentInput(
                title=kp_data.title,
                description=kp_data.description,
                category=kp_data.category,
                examples=examples,
                tags=kp_data.tags
            )
            knowledge_points.append(kp_input)
        
        conversion_time = time.time() - conversion_start
        logger.debug(f"[{request_id}] Response conversion completed in {conversion_time:.3f}s")
        
        # 准备响应
        response_text_preview = extracted_text[:2000] + ("..." if len(extracted_text) > 2000 else "")
        
        total_time = time.time() - start_time
        logger.info(f"[{request_id}] Document parsing completed successfully")
        logger.info(f"[{request_id}] Total processing time: {total_time:.3f}s")
        logger.info(f"[{request_id}] Timing breakdown - File read: {file_read_time:.3f}s, Text extraction: {text_extract_time:.3f}s, AI processing: {ai_time:.3f}s, Conversion: {conversion_time:.3f}s")
        logger.info(f"[{request_id}] Final result: {len(knowledge_points)} knowledge points generated")
        
        # Log summary statistics
        total_examples = sum(len(kp.examples) for kp in knowledge_points)
        categories = [kp.category for kp in knowledge_points if kp.category]
        unique_categories = set(categories) if categories else set()
        total_tags = sum(len(kp.tags or []) for kp in knowledge_points)
        
        logger.info(f"[{request_id}] Content statistics - Total examples: {total_examples}, "
                   f"Categories: {len(unique_categories)}, Total tags: {total_tags}")
        
        return DocumentParseResponse(
            filename=file.filename,
            extracted_text=response_text_preview,
            knowledge_points=knowledge_points,
            total_points=len(knowledge_points)
        )
        
    except HTTPException as he:
        total_time = time.time() - start_time
        logger.warning(f"[{request_id}] HTTP exception after {total_time:.3f}s: {he.detail}")
        raise
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"[{request_id}] Document parsing failed after {total_time:.3f}s: {str(e)}")
        logger.error(f"[{request_id}] Exception type: {type(e).__name__}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"解析文档失败: {str(e)}"
        )


@router.post(
    "/batch-documents",
    response_model=BatchKnowledgePointsResponse,
    summary="批量添加知识点",
    description="批量添加多个知识点到知识库"
)
async def batch_add_documents(request: BatchKnowledgePointsRequest):
    """
    批量添加知识点
    
    - **knowledge_points**: 知识点列表
    """
    try:
        success_ids = []
        errors = []
        
        for i, knowledge_point in enumerate(request.knowledge_points):
            try:
                import uuid
                from datetime import datetime
                from schemas.embeddings import DocumentInput
                
                # 生成知识点ID
                knowledge_id = str(uuid.uuid4())
                
                # 准备文档内容 - 主要用于向量搜索
                content_parts = [
                    f"知识点: {knowledge_point.title}",
                    f"描述: {knowledge_point.description}",
                    f"分类: {knowledge_point.category or 'general'}"
                ]
                
                # 添加例题到内容中用于向量搜索
                for j, example in enumerate(knowledge_point.examples, 1):
                    content_parts.extend([
                        f"例题{j}: {example.question}",
                        f"解答步骤: {example.solution}"
                    ])
                
                if knowledge_point.tags:
                    content_parts.append(f"标签: {', '.join(knowledge_point.tags)}")
                
                document_content = "\n".join(content_parts)
                
                # 准备元数据
                examples_data = [
                    {
                        "question": ex.question,
                        "solution": ex.solution,
                        "difficulty": ex.difficulty
                    } for ex in knowledge_point.examples
                ]
                
                current_time = datetime.now().isoformat()
                metadata = {
                    "title": knowledge_point.title,
                    "description": knowledge_point.description,
                    "category": knowledge_point.category or "general",
                    "tags": json.dumps(knowledge_point.tags or [], ensure_ascii=False),
                    "examples": json.dumps(examples_data, ensure_ascii=False),
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
                
                # 添加到双重存储系统（ChromaDB + Elasticsearch）
                success = await rag_service.add_documents(
                    documents=[document],
                    request_id=knowledge_id[:8]  # 使用知识点ID的前8位作为请求ID
                )
                
                if success:
                    success_ids.append(knowledge_id)
                else:
                    errors.append(f"知识点 {i+1} ({knowledge_point.title}): 添加到向量数据库失败")
                    
            except Exception as e:
                logger.error(f"批量添加知识点 {i+1} 失败: {e}")
                errors.append(f"知识点 {i+1} ({knowledge_point.title}): {str(e)}")
        
        return BatchKnowledgePointsResponse(
            success_count=len(success_ids),
            failed_count=len(errors),
            total_count=len(request.knowledge_points),
            success_ids=success_ids,
            errors=errors
        )
        
    except Exception as e:
        logger.error(f"批量添加知识点接口错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量添加知识点失败: {str(e)}"
        )

