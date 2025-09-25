'use client';

import { cn } from '@/lib/utils';
import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { parseKnowledgeTags, renderTextWithKnowledgeTags } from '@/lib/knowledge-parser';
import { preprocessContent } from '@/lib/latex-processor';

interface ResponseProps {
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
      if (React.isValidElement(child)) {
        const element = child as React.ReactElement<any>;
        if (element.props && element.props.children) {
          return React.cloneElement(element, {
            ...element.props,
            children: processMarkdownChildren(element.props.children)
          });
        }
      }
      return child;
    });
  }

  // 处理单个React元素
  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<any>;
    if (element.props && element.props.children) {
      return React.cloneElement(element, {
        ...element.props,
        children: processMarkdownChildren(element.props.children)
      });
    }
  }

  return children;
};

export const Response = memo(
  ({ children, className }: ResponseProps) => {
    // 预处理内容：处理数学公式和知识点标记
    const { processedContent, hasKnowledgeTags } = useMemo(() => {
      return preprocessContent(children);
    }, [children]);
    
    return (
      <div
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          // 添加数学公式间距样式
          '[&_.katex]:mx-2',
          '[&_.katex-display]:my-6',
          '[&_p:has(.katex)]:my-4',
          className,
        )}
      >
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
          components={{
            // 处理段落中的知识点标记
            p: ({ children }) => {
              return <p>{processMarkdownChildren(children)}</p>;
            },
            // 处理列表项中的知识点标记
            li: ({ children }) => {
              return <li>{processMarkdownChildren(children)}</li>;
            },
            // 处理标题中的知识点标记
            h1: ({ children }) => {
              return <h1>{processMarkdownChildren(children)}</h1>;
            },
            h2: ({ children }) => {
              return <h2>{processMarkdownChildren(children)}</h2>;
            },
            h3: ({ children }) => {
              return <h3>{processMarkdownChildren(children)}</h3>;
            },
            h4: ({ children }) => {
              return <h4>{processMarkdownChildren(children)}</h4>;
            },
            h5: ({ children }) => {
              return <h5>{processMarkdownChildren(children)}</h5>;
            },
            h6: ({ children }) => {
              return <h6>{processMarkdownChildren(children)}</h6>;
            },
            // 处理强调文本中的知识点标记
            strong: ({ children }) => {
              return <strong>{processMarkdownChildren(children)}</strong>;
            },
            em: ({ children }) => {
              return <em>{processMarkdownChildren(children)}</em>;
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = 'Response';
