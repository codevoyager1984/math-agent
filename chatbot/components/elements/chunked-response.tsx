'use client';

import { cn } from '@/lib/utils';
import React, { memo, useMemo, isValidElement, cloneElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { parseKnowledgeTags, renderTextWithKnowledgeTags } from '@/lib/knowledge-parser';
import { preprocessContent } from '@/lib/latex-processor';
import { useChunkedContent } from '@/lib/chunk-renderer';

interface ChunkedResponseProps {
  children: string;
  className?: string;
}

// 处理markdown子节点中的知识点标记
const processMarkdownChildren = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string') {
    return renderTextWithKnowledgeTags(children);
  }

  if (Array.isArray(children)) {
    return children.map((child, index) => {
      if (typeof child === 'string') {
        return <span key={index}>{renderTextWithKnowledgeTags(child)}</span>;
      }
      // 递归处理React元素的children
      if (isValidElement(child)) {
        const element = child as React.ReactElement<any>;
        if (element.props && element.props.children) {
          return cloneElement(element, {
            ...element.props,
            children: processMarkdownChildren(element.props.children)
          });
        }
      }
      return child;
    });
  }

  // 处理单个React元素
  if (isValidElement(children)) {
    const element = children as React.ReactElement<any>;
    if (element.props && element.props.children) {
      return cloneElement(element, {
        ...element.props,
        children: processMarkdownChildren(element.props.children)
      });
    }
  }

  return children;
};

// Memoized chunk component to prevent unnecessary re-renders
const ChunkRenderer = memo(({ chunk, chunkIndex }: { chunk: string; chunkIndex: number }) => {
  // 预处理内容：处理数学公式和知识点标记
  const { processedContent } = useMemo(() => {
    return preprocessContent(chunk);
  }, [chunk]);

  return (
    <div key={`chunk-${chunkIndex}`} className="chunk-content p-0 m-0">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          [remarkMath, { 
            singleDollarTextMath: true
          }]
        ]}
        rehypePlugins={[
          [rehypeKatex, { 
            throwOnError: false,
            strict: false
          }]
        ]}
        skipHtml={false}
        components={{
          // 处理段落中的知识点标记
          p: ({ children }) => {
            return <p className="mb-1 mt-1 whitespace-pre-wrap leading-relaxed">{processMarkdownChildren(children)}</p>;
          },
          // 处理有序列表
          ol: ({ children, ...props }) => {
            return <ol className="list-decimal list-outside ml-6 space-y-4" {...props}>{children}</ol>;
          },
          // 处理无序列表
          ul: ({ children, ...props }) => {
            return <ul className="list-disc list-outside ml-6 space-y-2" {...props}>{children}</ul>;
          },
          // 处理列表项中的知识点标记
          li: ({ children }) => {
            return <li className="mb-4 leading-relaxed">{processMarkdownChildren(children)}</li>;
          },
          // 处理标题中的知识点标记
          h1: ({ children }) => {
            return <h1 className="mb-4">{processMarkdownChildren(children)}</h1>;
          },
          h2: ({ children }) => {
            return <h2 className="mb-3">{processMarkdownChildren(children)}</h2>;
          },
          h3: ({ children }) => {
            return <h3 className="mb-2">{processMarkdownChildren(children)}</h3>;
          },
          h4: ({ children }) => {
            return <h4 className="mb-2">{processMarkdownChildren(children)}</h4>;
          },
          h5: ({ children }) => {
            return <h5 className="mb-2">{processMarkdownChildren(children)}</h5>;
          },
          h6: ({ children }) => {
            return <h6 className="mb-2">{processMarkdownChildren(children)}</h6>;
          },
          // 处理强调文本中的知识点标记
          strong: ({ children }) => {
            return <strong>{processMarkdownChildren(children)}</strong>;
          },
          em: ({ children }) => {
            return <em>{processMarkdownChildren(children)}</em>;
          },
          // 处理换行
          br: () => {
            return <br className="my-1" />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the chunk content has actually changed
  return prevProps.chunk === nextProps.chunk && prevProps.chunkIndex === nextProps.chunkIndex;
});

ChunkRenderer.displayName = 'ChunkRenderer';

export const ChunkedResponse = memo(
  ({ children, className }: ChunkedResponseProps) => {
    // Split content into chunks and only render new/changed chunks
    const chunks = useChunkedContent(children);
    
    return (
      <div
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          // 移除chunk之间的间距
          '[&_.chunk-content:not(:first-child)>*:first-child]:!mt-0',
          '[&_.chunk-content:not(:last-child)>*:last-child]:!mb-0',
          // 强制数学公式间距样式 - 使用更高的优先级
          '[&_.katex]:!mx-1',
          '[&_.katex-display]:!my-8',
          '[&_p:has(.katex)]:!my-6',
          // 专门针对数学公式行增加间距
          '[&_p]:!leading-relaxed',
          '[&_p]:!my-2',
          // 列表样式优化
          '[&_ol]:mb-4',
          '[&_ul]:mb-4',
          '[&_li]:mb-3',
          '[&_li_p]:mb-2',
          // 确保列表项内的段落有适当间距
          '[&_li>p:last-child]:mb-0',
          className,
        )}
      >
        {chunks.map((chunk, index) => (
          <ChunkRenderer
            key={`chunk-${index}`}
            chunk={chunk}
            chunkIndex={index}
          />
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if content length has significantly changed or content is completely different
    const lengthDiff = Math.abs(prevProps.children.length - nextProps.children.length);
    return lengthDiff === 0 || (lengthDiff < 100 && prevProps.children === nextProps.children);
  },
);

ChunkedResponse.displayName = 'ChunkedResponse';
