'use client';

import { Reasoning, ReasoningTrigger, ReasoningContent } from './elements/reasoning';

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
}

export function MessageReasoning({
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  
  // 为已完成的推理提供一个合理的持续时间（基于内容长度估算）
  const estimatedDuration = !isLoading ? Math.max(1, Math.round(reasoning.length / 100)) : 0;
  
  return (
    <Reasoning 
      isStreaming={isLoading} 
      defaultOpen={true}
      duration={estimatedDuration} // 传递估算的持续时间
      data-testid="message-reasoning"
    >
      <ReasoningTrigger />
      <ReasoningContent>{reasoning}</ReasoningContent>
    </Reasoning>
  );
}
