"""
嵌入向量和 RAG 相关的 Pydantic 模型
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class DocumentInput(BaseModel):
    """输入文档模型"""
    id: str = Field(..., description="文档唯一标识符")
    content: str = Field(..., description="文档内容")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="文档元数据")


class DocumentsAddRequest(BaseModel):
    """批量添加文档请求"""
    documents: List[DocumentInput] = Field(..., description="文档列表")

class QueryRequest(BaseModel):
    """查询请求模型"""
    query: str = Field(..., description="查询文本")
    n_results: int = Field(default=5, ge=1, le=20, description="返回结果数量")
    include_metadata: bool = Field(default=True, description="是否包含元数据")


class DocumentResult(BaseModel):
    """文档查询结果"""
    id: str = Field(..., description="文档ID")
    content: str = Field(..., description="文档内容")
    distance: float = Field(..., description="距离分数")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="文档元数据")


class QueryResponse(BaseModel):
    """查询响应模型"""
    results: List[DocumentResult] = Field(..., description="查询结果列表")
    query: str = Field(..., description="原始查询")
    total_results: int = Field(..., description="总结果数")


class CollectionInfo(BaseModel):
    """集合信息"""
    name: str = Field(..., description="集合名称")
    count: int = Field(..., description="文档数量")


# 数学知识点相关模型
class ExampleInput(BaseModel):
    """例题输入模型"""
    question: str = Field(..., description="例题题目")
    solution: str = Field(..., description="解题步骤")
    difficulty: Optional[str] = Field(default="medium", description="难度等级：easy, medium, hard")


class KnowledgePointInput(BaseModel):
    """知识点输入模型"""
    title: str = Field(..., description="知识点名称")
    description: str = Field(..., description="知识点描述")
    category: Optional[str] = Field(default="general", description="知识点分类")
    examples: List[ExampleInput] = Field(default=[], description="相关例题列表")
    tags: Optional[List[str]] = Field(default=[], description="标签列表")

class KnowledgePointAddRequest(BaseModel):
    """添加知识点请求"""
    knowledge_point: KnowledgePointInput = Field(..., description="知识点信息")

class KnowledgePointResponse(BaseModel):
    """知识点响应模型"""
    id: str = Field(..., description="知识点ID")
    title: str = Field(..., description="知识点名称")  
    description: str = Field(..., description="知识点描述")
    category: str = Field(..., description="知识点分类")
    examples: List[Dict[str, Any]] = Field(..., description="相关例题列表")
    tags: List[str] = Field(..., description="标签列表")
    created_at: Optional[str] = Field(default=None, description="创建时间")
    updated_at: Optional[str] = Field(default=None, description="更新时间")


class KnowledgePointsResponse(BaseModel):
    """知识点列表响应"""
    knowledge_points: List[KnowledgePointResponse] = Field(..., description="知识点列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    limit: int = Field(..., description="每页数量")