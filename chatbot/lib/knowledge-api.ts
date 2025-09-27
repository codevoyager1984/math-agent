/**
 * 知识库API服务模块
 * 封装与rag-server的知识库相关通信
 */

import { getRagApiUrl } from './rag-config';

// 知识点相关的类型定义
export interface KnowledgePoint {
  id: string;
  title: string;
  description: string;
  category: string;
  examples: Array<{
    question: string;
    solution: string;
    difficulty: string;
  }>;
  tags: string[];
  created_at?: string;
  updated_at?: string;
  relevanceScore?: number;
}

export interface KnowledgePointsListResponse {
  knowledge_points: KnowledgePoint[];
  total: number;
  page: number;
  limit: number;
}

export interface QueryResponse {
  results: Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    distance?: number;
    similarity_score?: number;
  }>;
  total_results: number;
  search_mode: string;
  timing: Record<string, number>;
}

/**
 * 知识库API服务类
 */
export class KnowledgeApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${getRagApiUrl()}/knowledge-base`;
  }

  /**
   * 获取知识点列表
   */
  async getKnowledgePoints(params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  } = {}): Promise<KnowledgePointsListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.category) queryParams.set('category', params.category);
    if (params.search) queryParams.set('search', params.search);

    const url = `${this.baseUrl}/documents${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`获取知识点列表失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 获取知识点详情
   */
  async getKnowledgePoint(id: string): Promise<KnowledgePoint> {
    const response = await fetch(`${this.baseUrl}/documents/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('知识点不存在');
      }
      throw new Error(`获取知识点详情失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 搜索知识点
   */
  async searchKnowledgePoints(params: {
    query: string;
    n_results?: number;
    search_mode?: 'vector' | 'text' | 'hybrid';
    vector_weight?: number;
    text_weight?: number;
    enable_rerank?: boolean;
  }): Promise<QueryResponse> {
    const response = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: params.query,
        n_results: params.n_results || 10,
        include_metadata: true,
        search_mode: params.search_mode || 'hybrid',
        vector_weight: params.vector_weight || 0.6,
        text_weight: params.text_weight || 0.4,
        enable_rerank: params.enable_rerank || true,
      }),
    });

    if (!response.ok) {
      throw new Error(`搜索知识点失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 获取所有知识点名称
   */
  async getKnowledgePointNames(): Promise<{ names: string[]; count: number }> {
    const response = await fetch(`${this.baseUrl}/names`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`获取知识点名称失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 获取知识库信息
   */
  async getCollectionInfo(): Promise<{ count: number; name: string }> {
    const response = await fetch(`${this.baseUrl}/info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`获取知识库信息失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

// 导出单例实例
export const knowledgeApi = new KnowledgeApiService();

// 便捷函数
export async function getKnowledgePoints(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<KnowledgePointsListResponse> {
  return knowledgeApi.getKnowledgePoints(params);
}

export async function getKnowledgePoint(id: string): Promise<KnowledgePoint> {
  return knowledgeApi.getKnowledgePoint(id);
}

export async function searchKnowledgePoints(query: string, options?: {
  n_results?: number;
  search_mode?: 'vector' | 'text' | 'hybrid';
}): Promise<KnowledgePoint[]> {
  const response = await knowledgeApi.searchKnowledgePoints({
    query,
    ...options,
  });

  // 转换搜索结果为KnowledgePoint格式
  return response.results.map(result => {
    const metadata = result.metadata || {};
    
    // 解析序列化的数据
    let examples = [];
    let tags = [];
    
    try {
      examples = JSON.parse(metadata.examples || '[]');
      tags = JSON.parse(metadata.tags || '[]');
    } catch (e) {
      examples = metadata.examples || [];
      tags = metadata.tags || [];
    }

    return {
      id: result.id,
      title: metadata.title || '未知知识点',
      description: metadata.description || '',
      category: metadata.category || 'general',
      examples,
      tags,
      created_at: metadata.created_at,
      updated_at: metadata.updated_at,
      relevanceScore: result.similarity_score || result.distance || 0,
    };
  });
}
