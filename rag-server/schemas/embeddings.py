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
    """查询请求模型 - 支持混合搜索"""
    query: str = Field(..., description="查询文本")
    n_results: int = Field(default=5, ge=1, le=20, description="返回结果数量")
    include_metadata: bool = Field(default=True, description="是否包含元数据")

    # 混合搜索参数（可选，保持向后兼容）
    search_mode: str = Field(default="hybrid", description="搜索模式: vector, text, hybrid")
    vector_weight: float = Field(default=0.6, ge=0.0, le=1.0, description="向量搜索权重")
    text_weight: float = Field(default=0.4, ge=0.0, le=1.0, description="文本搜索权重")
    enable_rerank: bool = Field(default=True, description="是否启用重排序")
    rerank_top_k: Optional[int] = Field(default=None, description="重排序后返回的top结果数量")


class HybridQueryRequest(BaseModel):
    """混合搜索请求模型"""
    query: str = Field(..., description="查询文本")
    n_results: int = Field(default=5, ge=1, le=20, description="返回结果数量")
    include_metadata: bool = Field(default=True, description="是否包含元数据")
    search_mode: str = Field(default="hybrid", description="搜索模式: vector, text, hybrid")
    vector_weight: float = Field(default=0.6, ge=0.0, le=1.0, description="向量搜索权重")
    text_weight: float = Field(default=0.4, ge=0.0, le=1.0, description="文本搜索权重")
    enable_rerank: bool = Field(default=True, description="是否启用重排序")
    rerank_top_k: Optional[int] = Field(default=None, description="重排序后返回的top结果数量")


class DocumentResult(BaseModel):
    """文档查询结果 - 支持混合搜索评分"""
    id: str = Field(..., description="文档ID")
    content: str = Field(..., description="文档内容")
    distance: float = Field(..., description="距离分数")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="文档元数据")

    # 混合搜索评分信息（可选）
    vector_score: Optional[float] = Field(default=None, description="向量相似度分数")
    text_score: Optional[float] = Field(default=None, description="文本匹配分数")
    fusion_score: Optional[float] = Field(default=None, description="融合分数")
    rerank_score: Optional[float] = Field(default=None, description="重排序分数")
    final_score: Optional[float] = Field(default=None, description="最终分数")
    highlight: Optional[Dict[str, Any]] = Field(default=None, description="高亮信息")


class RankedDocumentResult(BaseModel):
    """重排序文档查询结果"""
    id: str = Field(..., description="文档ID")
    title: Optional[str] = Field(default=None, description="文档标题")
    description: Optional[str] = Field(default=None, description="文档描述")
    category: Optional[str] = Field(default=None, description="文档分类")
    examples: Optional[List[Dict[str, Any]]] = Field(default=None, description="例题列表")
    tags: Optional[List[str]] = Field(default=None, description="标签列表")
    created_at: Optional[str] = Field(default=None, description="创建时间")
    updated_at: Optional[str] = Field(default=None, description="更新时间")

    # 评分信息
    vector_score: Optional[float] = Field(default=None, description="向量相似度分数")
    text_score: Optional[float] = Field(default=None, description="文本匹配分数")
    fusion_score: Optional[float] = Field(default=None, description="融合分数")
    rerank_score: Optional[float] = Field(default=None, description="重排序分数")
    final_score: Optional[float] = Field(default=None, description="最终分数")

    # 元数据
    search_metadata: Optional[Dict[str, Any]] = Field(default=None, description="搜索元数据")
    highlight: Optional[Dict[str, Any]] = Field(default=None, description="高亮信息")


class QueryResponse(BaseModel):
    """查询响应模型 - 支持混合搜索结果"""
    results: List[DocumentResult] = Field(..., description="查询结果列表")
    query: str = Field(..., description="原始查询")
    total_results: int = Field(..., description="总结果数")

    # 混合搜索元信息（可选）
    search_mode: Optional[str] = Field(default=None, description="实际使用的搜索模式")
    timing: Optional[Dict[str, float]] = Field(default=None, description="各阶段用时统计")
    search_stats: Optional[Dict[str, Any]] = Field(default=None, description="搜索统计信息")


class HybridQueryResponse(BaseModel):
    """混合搜索响应模型"""
    results: List[RankedDocumentResult] = Field(..., description="查询结果列表")
    query: str = Field(..., description="原始查询")
    total_results: int = Field(..., description="总结果数")
    search_mode: str = Field(..., description="搜索模式")

    # 性能指标
    timing: Dict[str, float] = Field(..., description="各阶段用时统计")
    search_stats: Dict[str, Any] = Field(..., description="搜索统计信息")


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


class AddDocumentInput(BaseModel):
    """知识点输入模型"""
    title: str = Field(..., description="知识点名称")
    description: str = Field(..., description="知识点描述")
    category: Optional[str] = Field(default="general", description="知识点分类")
    examples: List[ExampleInput] = Field(default=[], description="相关例题列表")
    tags: Optional[List[str]] = Field(default=[], description="标签列表")

class KnowledgePointAddRequest(BaseModel):
    """添加知识点请求"""
    knowledge_point: AddDocumentInput = Field(..., description="知识点信息")

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
    similarity_score: Optional[float] = Field(default=None, description="相似度分数(仅在搜索时返回)")


class KnowledgePointsResponse(BaseModel):
    """知识点列表响应"""
    knowledge_points: List[KnowledgePointResponse] = Field(..., description="知识点列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    limit: int = Field(..., description="每页数量")


# 文档上传和处理相关模型
class DocumentParseRequest(BaseModel):
    """文档解析请求"""
    filename: str = Field(..., description="文件名")
    max_knowledge_points: int = Field(default=10, ge=1, le=20, description="最大知识点数量")


class DocumentParseResponse(BaseModel):
    """文档解析响应"""
    filename: str = Field(..., description="文件名")
    extracted_text: str = Field(..., description="提取的文本内容")
    knowledge_points: List[AddDocumentInput] = Field(..., description="生成的知识点列表")
    total_points: int = Field(..., description="知识点总数")


class BatchKnowledgePointsRequest(BaseModel):
    """批量添加知识点请求"""
    knowledge_points: List[AddDocumentInput] = Field(..., description="知识点列表")


class BatchKnowledgePointsResponse(BaseModel):
    """批量添加知识点响应"""
    success_count: int = Field(..., description="成功添加的数量")
    failed_count: int = Field(..., description="失败的数量")
    total_count: int = Field(..., description="总数量")
    success_ids: List[str] = Field(..., description="成功添加的知识点ID列表")
    errors: List[str] = Field(default=[], description="错误信息列表")