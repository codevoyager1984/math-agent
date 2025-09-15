import { request } from './base';

// 知识点相关类型定义
export interface Example {
  question: string;
  solution: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface DocumentInput {
  title: string;
  description: string;
  category?: string;
  examples: Example[];
  tags?: string[];
}

export interface KnowledgePoint {
  id: string;
  title: string;
  description: string;
  category: string;
  examples: Example[];
  tags: string[];
  created_at?: string;
  updated_at?: string;
  similarity_score?: number;
}

export interface KnowledgePointsResponse {
  knowledge_points: KnowledgePoint[];
  total: number;
  page: number;
  limit: number;
}

export interface KnowledgePointListParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

// 添加知识点
export const addDocument = async (document: DocumentInput): Promise<KnowledgePoint> => {
  return await request<KnowledgePoint>({
    url: '/knowledge-base/documents',
    method: 'POST',
    data: document
  });
};

// 更新知识点
export const updateKnowledgePoint = async (id: string, document: DocumentInput): Promise<KnowledgePoint> => {
  return await request<KnowledgePoint>({
    url: `/knowledge-base/documents/${id}`,
    method: 'PUT',
    data: document
  });
};

// 获取知识点列表
export const getKnowledgePoints = async (params?: KnowledgePointListParams): Promise<KnowledgePointsResponse> => {
  return await request<KnowledgePointsResponse>({
    url: '/knowledge-base/documents',
    method: 'GET',
    params,
  });
};

// 获取知识点详情
export const getKnowledgePoint = async (id: string): Promise<KnowledgePoint> => {
  return await request<KnowledgePoint>({
    url: `/knowledge-base/documents/${id}`,
    method: 'GET',
  });
};

// 删除知识点
export const deleteKnowledgePoint = async (id: string): Promise<void> => {
  await request<void>({
    url: `/knowledge-base/documents/${id}`,
    method: 'DELETE',
  });
};

// 混合搜索参数接口
export interface QueryParams {
  query: string;
  n_results?: number;
  include_metadata?: boolean;
  search_mode?: 'vector' | 'text' | 'hybrid';
  vector_weight?: number;
  text_weight?: number;
  enable_rerank?: boolean;
  rerank_method?: 'cross_encoder' | 'llm';
  rerank_top_k?: number;
}

// 查询响应接口
export interface QueryResult {
  id: string;
  content: string;
  distance: number;
  metadata?: Record<string, any>;
  // 混合搜索评分信息
  vector_score?: number;
  text_score?: number;
  fusion_score?: number;
  rerank_score?: number;
  final_score?: number;
  similarity_score?: number; // 统一的相似度分数(0-100)
  highlight?: Record<string, any>;
}

export interface QueryResponse {
  results: QueryResult[];
  query: string;
  total_results: number;
  // 混合搜索元信息
  search_mode?: string;
  timing?: Record<string, number>;
  search_stats?: Record<string, any>;
}

// 查询文档（支持混合搜索）
export const queryDocuments = async (params: QueryParams): Promise<QueryResponse> => {
  const {
    query,
    n_results = 5,
    include_metadata = true,
    search_mode = 'hybrid',
    vector_weight = 0.6,
    text_weight = 0.4,
    enable_rerank = true,
    rerank_top_k
  } = params;

  return await request<QueryResponse>({
    url: '/knowledge-base/query',
    method: 'POST',
    data: {
      query,
      n_results,
      include_metadata,
      search_mode,
      vector_weight,
      text_weight,
      enable_rerank,
      rerank_top_k
    },
  });
};

// 向后兼容的简单查询函数
export const simpleQueryDocuments = async (query: string, nResults: number = 5): Promise<QueryResponse> => {
  return await queryDocuments({
    query,
    n_results: nResults,
    search_mode: 'vector'
  });
};

// 获取集合信息
export const getCollectionInfo = async (): Promise<any> => {
  return await request<any>({
    url: '/knowledge-base/info',
    method: 'GET',
  });
};

// 清空知识库
export const clearKnowledgeBase = async (): Promise<void> => {
  await request<void>({
    url: '/knowledge-base/delete-all',
    method: 'POST',
  });
};

// 文档处理相关接口
export interface DocumentParseResponse {
  filename: string;
  extracted_text: string;
  knowledge_points: DocumentInput[];
  total_points: number;
}

export interface BatchKnowledgePointsResponse {
  success_count: number;
  failed_count: number;
  total_count: number;
  success_ids: string[];
  errors: string[];
}

// 解析文档生成知识点预览
export const parseDocument = async (
  file: File, 
  maxDocuments: number = 10
): Promise<DocumentParseResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  
  return await request<DocumentParseResponse>({
    url: `/knowledge-base/upload-document?max_documents=${maxDocuments}`,
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// 批量添加知识点
export const batchAddKnowledgePoints = async (
  knowledgePoints: DocumentInput[]
): Promise<BatchKnowledgePointsResponse> => {
  return await request<BatchKnowledgePointsResponse>({
    url: '/knowledge-base/batch-documents',
    method: 'POST',
    data: {
      knowledge_points: knowledgePoints
    },
  });
};
