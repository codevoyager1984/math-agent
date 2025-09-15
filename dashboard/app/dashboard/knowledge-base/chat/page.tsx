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
  const [fullExtractedText, setFullExtractedText] = useState<string>('');
  
  const sessionId = searchParams.get('sessionId');
  const filename = searchParams.get('filename');
  const preview = searchParams.get('preview');

  // 如果缺少必要参数，返回知识库页面
  useEffect(() => {
    if (!sessionId || !filename) {
      router.push('/dashboard/knowledge-base');
    }
  }, [sessionId, filename, router]);

  // 获取会话的完整提取文本
  useEffect(() => {
    const fetchSessionData = async () => {
      if (!sessionId) return;
      
      try {
        console.log('Fetching session data for:', sessionId);
        const response = await fetch(`/api/knowledge-base/chat-session/${sessionId}`);
        if (response.ok) {
          const sessionData = await response.json();
          console.log('Session data received:', sessionData);
          if (sessionData.extracted_text) {
            setFullExtractedText(sessionData.extracted_text);
            console.log('Loaded full extracted text:', sessionData.extracted_text.length, 'characters');
          }
        } else {
          console.error('Failed to fetch session data:', response.status);
        }
      } catch (error) {
        console.error('Error fetching session data:', error);
      }
    };
    
    fetchSessionData();
  }, [sessionId]);

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

  if (!sessionId || !filename) {
    return null; // 或者显示加载状态
  }

  return (
    <>
      <DocumentChatPage
        sessionId={sessionId}
        filename={decodeURIComponent(filename)}
        extractedTextPreview={preview ? decodeURIComponent(preview) : ''}
        onKnowledgePointsReady={handleKnowledgePointsReady}
      />
      
      {/* 知识点预览模态框 */}
      {showPreview && knowledgePoints.length > 0 && (
        <KnowledgePointPreview
          opened={showPreview}
          onClose={handlePreviewClose}
          filename={decodeURIComponent(filename)}
          extractedText={fullExtractedText}
          knowledgePoints={knowledgePoints}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
