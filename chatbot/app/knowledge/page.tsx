import { Metadata } from 'next';
import { KnowledgeListPage } from '@/components/knowledge/knowledge-list-page';

export const metadata: Metadata = {
  title: '知识库 - 数学助手',
  description: '浏览和搜索数学知识点，查看详细的概念解释和例题',
};

export default function KnowledgePage() {
  return <KnowledgeListPage />;
}
