import React from 'react';
import { KnowledgeTooltip } from '@/components/knowledge-tooltip';

interface KnowledgeTag {
  id: string;
  displayText: string;
  startIndex: number;
  endIndex: number;
}

/**
 * 解析文本中的知识点标记
 * 格式: [[knowledge:知识点ID:显示文本]]
 */
export function parseKnowledgeTags(text: string): KnowledgeTag[] {
  const regex = /\[\[knowledge:([^:]+):([^\]]+)\]\]/g;
  const tags: KnowledgeTag[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    tags.push({
      id: match[1],
      displayText: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return tags;
}

/**
 * 将包含知识点标记的文本渲染为React组件
 */
export function renderTextWithKnowledgeTags(text: string): React.ReactNode {
  const tags = parseKnowledgeTags(text);
  
  if (tags.length === 0) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  tags.forEach((tag, index) => {
    // 添加标记前的文本
    if (tag.startIndex > lastIndex) {
      parts.push(text.slice(lastIndex, tag.startIndex));
    }

    // 添加知识点组件
    parts.push(
      <KnowledgeTooltip
        key={`knowledge-${tag.id}-${index}`}
        knowledgeId={tag.id}
        displayText={tag.displayText}
      >
        {tag.displayText}
      </KnowledgeTooltip>
    );

    lastIndex = tag.endIndex;
  });

  // 添加最后剩余的文本
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

/**
 * 清理文本中的知识点标记，返回纯文本
 */
export function cleanKnowledgeTags(text: string): string {
  return text.replace(/\[\[knowledge:([^:]+):([^\]]+)\]\]/g, '$2');
}
