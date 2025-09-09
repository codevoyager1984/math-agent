import { request } from './base';

// 知识点相关类型定义
export interface Example {
  question: string;
  solution: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface KnowledgePointInput {
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
export const addKnowledgePoint = async (knowledgePoint: KnowledgePointInput): Promise<KnowledgePoint> => {
  return await request<KnowledgePoint>({
    url: '/embedding/knowledge-points',
    method: 'POST',
    data: {
      knowledge_point: knowledgePoint
    },
  });
};

// 更新知识点
export const updateKnowledgePoint = async (id: string, knowledgePoint: KnowledgePointInput): Promise<KnowledgePoint> => {
  return await request<KnowledgePoint>({
    url: `/embedding/knowledge-points/${id}`,
    method: 'PUT',
    data: {
      knowledge_point: knowledgePoint
    },
  });
};

// 获取知识点列表
export const getKnowledgePoints = async (params?: KnowledgePointListParams): Promise<KnowledgePointsResponse> => {
  return await request<KnowledgePointsResponse>({
    url: '/embedding/knowledge-points',
    method: 'GET',
    params,
  });
};

// 获取知识点详情
export const getKnowledgePoint = async (id: string): Promise<KnowledgePoint> => {
  return await request<KnowledgePoint>({
    url: `/embedding/knowledge-points/${id}`,
    method: 'GET',
  });
};

// 删除知识点
export const deleteKnowledgePoint = async (id: string): Promise<void> => {
  await request<void>({
    url: `/embedding/knowledge-points/${id}`,
    method: 'DELETE',
  });
};

// 查询文档（用于搜索知识点）
export const queryDocuments = async (query: string, nResults: number = 5): Promise<any> => {
  return await request<any>({
    url: '/embedding/query',
    method: 'POST',
    data: {
      query,
      n_results: nResults,
      include_metadata: true
    },
  });
};

// 获取集合信息
export const getCollectionInfo = async (): Promise<any> => {
  return await request<any>({
    url: '/embedding/collections/math_knowledge',
    method: 'GET',
  });
};

// 清空知识库
export const clearKnowledgeBase = async (): Promise<void> => {
  await request<void>({
    url: '/embedding/clear',
    method: 'POST',
  });
};

// 文档处理相关接口
export interface DocumentParseResponse {
  filename: string;
  extracted_text: string;
  knowledge_points: KnowledgePointInput[];
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
  maxKnowledgePoints: number = 10
): Promise<DocumentParseResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  
  return await request<DocumentParseResponse>({
    url: `/embedding/parse-document?max_knowledge_points=${maxKnowledgePoints}`,
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// 批量添加知识点
export const batchAddKnowledgePoints = async (
  knowledgePoints: KnowledgePointInput[]
): Promise<BatchKnowledgePointsResponse> => {
  return await request<BatchKnowledgePointsResponse>({
    url: '/embedding/batch-knowledge-points',
    method: 'POST',
    data: {
      knowledge_points: knowledgePoints
    },
  });
};
