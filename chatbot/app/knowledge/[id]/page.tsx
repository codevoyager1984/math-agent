import { Metadata } from 'next';
import { KnowledgeDetailPage } from '@/components/knowledge/knowledge-detail-page';

export const metadata: Metadata = {
  title: '知识点详情 - 数学助手',
  description: '查看知识点的详细信息，包括概念解释、例题和解答步骤',
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function KnowledgeDetailRoute({ params }: PageProps) {
  const { id } = await params;
  return <KnowledgeDetailPage knowledgeId={id} />;
}
