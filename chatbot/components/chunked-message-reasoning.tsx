'use client';

import { ChunkedReasoning, ChunkedReasoningTrigger, ChunkedReasoningContent } from './elements/chunked-reasoning';

interface ChunkedMessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
}

export function ChunkedMessageReasoning({
  isLoading,
  reasoning,
}: ChunkedMessageReasoningProps) {
  
  // 为已完成的推理提供一个合理的持续时间（基于内容长度估算）
  const estimatedDuration = !isLoading ? Math.max(1, Math.round(reasoning.length / 100)) : 0;
  
  return (
    <ChunkedReasoning 
      isStreaming={isLoading} 
      defaultOpen={true}
      duration={estimatedDuration} // 传递估算的持续时间
      data-testid="chunked-message-reasoning"
    >
      <ChunkedReasoningTrigger />
      <ChunkedReasoningContent>{reasoning}</ChunkedReasoningContent>
    </ChunkedReasoning>
  );
}
