import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { ChatMessage } from '@/lib/types';

interface SearchKnowledgePointsProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const searchKnowledgePoints = ({ session, dataStream }: SearchKnowledgePointsProps) =>
  tool({
    description: 'Search for relevant math knowledge points, examples, and solution approaches from the knowledge base. Use this when users ask about math concepts, formulas, or need examples.',
    inputSchema: z.object({
      query: z.string().describe('The math topic or problem type to search for'),
      category: z.string().optional().describe('Optional category filter (e.g., "algebra", "geometry")'),
    }),
    execute: async ({ query, category }) => {
      try {
        // 向用户显示开始搜索知识点
        dataStream.write({
          type: 'data-knowledge-search-start',
          data: { query, category },
          transient: true,
        });

        // 调用 RAG 服务的知识点查询接口
        const ragServerUrl = process.env.RAG_SERVER_URL || 'http://localhost:8000';
        const response = await fetch(`${ragServerUrl}/api/embedding/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            n_results: 3, // 获取最相关的3个知识点
            include_metadata: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`RAG server error: ${response.status}`);
        }

        const data = await response.json();
        
        // 记录搜索结果的详细信息
        console.log(`🔍 知识点搜索结果:`, {
          query,
          totalResults: data.total_results || 0,
          resultsCount: data.results?.length || 0,
          firstResultDistance: data.results?.[0]?.distance || 'N/A'
        });
        
        // 处理返回的知识点数据
        const knowledgePoints = data.results?.map((result: any, index: number) => {
          const metadata = result.metadata || {};
          
          // 解析序列化的数据
          let examples = [];
          let tags = [];
          
          try {
            examples = JSON.parse(metadata.examples || '[]');
            tags = JSON.parse(metadata.tags || '[]');
          } catch (e) {
            console.warn('Failed to parse knowledge point metadata:', e);
          }

          const distance = result.distance || 0;
          
          // 记录每个结果的距离值用于调试
          console.log(`📊 知识点 ${index + 1} "${metadata.title}": 距离=${distance}`);
          
          return {
            id: result.id,
            title: metadata.title || '未知知识点',
            description: metadata.description || '',
            category: metadata.category || 'general',
            examples: examples.slice(0, 2), // 只返回前2个例题
            tags,
            relevanceScore: distance,
          };
        }) || [];

        // 向用户显示找到的知识点
        dataStream.write({
          type: 'data-knowledge-search-result',
          data: {
            query,
            knowledgePoints,
            totalFound: knowledgePoints.length,
          },
          transient: true,
        });

        // 完成搜索
        dataStream.write({
          type: 'data-knowledge-search-finish',
          data: null,
          transient: true,
        });

        const resultMessage = knowledgePoints.length > 0 
          ? `找到 ${knowledgePoints.length} 个相关知识点` 
          : '未找到相关知识点';

        return {
          query,
          knowledgePoints,
          totalFound: knowledgePoints.length,
          message: resultMessage,
          status: 'success'
        };
      } catch (error) {
        console.error('Knowledge search error:', error);
        
        // 向用户显示搜索失败
        dataStream.write({
          type: 'data-knowledge-search-error',
          data: { error: error instanceof Error ? error.message : '未知错误' },
          transient: true,
        });

        return {
          error: '知识点搜索失败',
          message: '无法连接到知识库服务',
          status: 'error'
        };
      }
    },
  });
