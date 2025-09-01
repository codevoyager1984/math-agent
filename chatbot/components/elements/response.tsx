'use client';

import { cn } from '@/lib/utils';
import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface ResponseProps {
  children: string;
  className?: string;
}

export const Response = memo(
  ({ children, className }: ResponseProps) => {
    // 预处理内容：将 \( \) 转换为 $ $，将 \[ \] 转换为 $$ $$
    const processedContent = useMemo(() => {
      if (!children) return '';
      
      let processed = children
        // 替换 \[ \] 为 $$ $$ (块级数学公式)
        .replace(/\\\[/g, '\n$$')
        .replace(/\\\]/g, '$$\n')
        // 替换 \( \) 为 $ $ (行内数学公式)
        .replace(/\\\(/g, '$')
        .replace(/\\\)/g, '$')
        // 确保块级公式前后有换行
        .replace(/([^\n])\$\$/g, '$1\n$$')
        .replace(/\$\$([^\n])/g, '$$\n$1');
      
      return processed;
    }, [children]);
    
    return (
      <div
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
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
          components={{}}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = 'Response';
