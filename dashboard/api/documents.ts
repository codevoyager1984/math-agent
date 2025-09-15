import { request } from './base';

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  text_preview?: string;
  user_requirements?: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
}

export interface ChatSession {
  id: string;
  document_id: string;
  status: 'active' | 'completed' | 'expired';
  created_at: string;
  last_activity: string;
  current_knowledge_points: any[];
}

export interface DocumentListParams {
  page?: number;
  limit?: number;
  status?: string;
}

// 获取文档列表
export const getDocuments = async (params: DocumentListParams = {}): Promise<DocumentListResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.status) queryParams.append('status', params.status);

  return await request<DocumentListResponse>({
    url: `/documents?${queryParams.toString()}`,
    method: 'GET',
  });
};

// 获取文档详情
export const getDocument = async (documentId: string): Promise<Document> => {
  return await request<Document>({
    url: `/documents/${documentId}`,
    method: 'GET',
  });
};

// 获取文档的聊天会话列表
export const getDocumentSessions = async (documentId: string): Promise<ChatSession[]> => {
  return await request<ChatSession[]>({
    url: `/documents/${documentId}/sessions`,
    method: 'GET',
  });
};

// 获取文档完整文本
export const getDocumentFullText = async (documentId: string): Promise<{
  document_id: string;
  filename: string;
  extracted_text: string;
  text_length: number;
}> => {
  return await request({
    url: `/documents/${documentId}/full-text`,
    method: 'GET',
  });
};

// 删除文档
export const deleteDocument = async (documentId: string): Promise<{ message: string; document_id: string }> => {
  return await request({
    url: `/documents/${documentId}`,
    method: 'DELETE',
  });
};
