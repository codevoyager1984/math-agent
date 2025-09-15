'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import DocumentChatPage from '@/components/knowledge-base/DocumentChatPage';
import { DocumentInput } from '@/api/knowledge';
import KnowledgePointPreview from '@/components/knowledge-base/KnowledgePointPreview';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showPreview, setShowPreview] = useState(false);
  const [knowledgePoints, setKnowledgePoints] = useState<DocumentInput[]>([]);
  
  const sessionId = searchParams.get('sessionId');
  const filename = searchParams.get('filename');
  const preview = searchParams.get('preview');

  // 如果缺少必要参数，返回知识库页面
  useEffect(() => {
    if (!sessionId || !filename || !preview) {
      router.push('/dashboard/knowledge-base');
    }
  }, [sessionId, filename, preview, router]);

  const handleKnowledgePointsReady = (points: DocumentInput[]) => {
    setKnowledgePoints(points);
    setShowPreview(true);
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    router.push('/dashboard/knowledge-base');
  };

  const handleSuccess = () => {
    router.push('/dashboard/knowledge-base');
  };

  if (!sessionId || !filename || !preview) {
    return null; // 或者显示加载状态
  }

  return (
    <>
      <DocumentChatPage
        sessionId={sessionId}
        filename={decodeURIComponent(filename)}
        extractedTextPreview={decodeURIComponent(preview)}
        onKnowledgePointsReady={handleKnowledgePointsReady}
      />
      
      {/* 知识点预览模态框 */}
      {showPreview && knowledgePoints.length > 0 && (
        <KnowledgePointPreview
          opened={showPreview}
          onClose={handlePreviewClose}
          filename={decodeURIComponent(filename)}
          extractedText={decodeURIComponent(preview)}
          knowledgePoints={knowledgePoints}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
