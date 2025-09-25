'use client';

import { cn } from '@/lib/utils';
import React, { memo, useMemo, useEffect, useState, useRef, isValidElement, cloneElement } from 'react';
import { useChunkedContent } from '@/lib/chunk-renderer';

interface OptimizedResponseProps {
  children: string;
  className?: string;
}

// Lazy load ReactMarkdown and KaTeX only when needed
const LazyMarkdownRenderer = memo(({ content }: { content: string }) => {
  const [isMarkdownLoaded, setIsMarkdownLoaded] = useState(false);
  const [MarkdownComponent, setMarkdownComponent] = useState<React.ComponentType<any> | null>(null);
  
  useEffect(() => {
    // Only load heavy markdown libraries when actually needed
    const loadMarkdown = async () => {
      try {
        const [
          { default: ReactMarkdown },
          { default: remarkGfm },
          { default: remarkMath },
          { default: rehypeKatex }
        ] = await Promise.all([
          import('react-markdown'),
          import('remark-gfm'),
          import('remark-math'),
          import('rehype-katex')
        ]);

        const { renderTextWithKnowledgeTags } = await import('@/lib/knowledge-parser');
        const { preprocessContent } = await import('@/lib/latex-processor');

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

        const MarkdownWithMath = memo(({ children: markdownContent }: { children: string }) => {
          const { processedContent } = useMemo(() => {
            return preprocessContent(markdownContent);
          }, [markdownContent]);

          return (
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
                p: ({ children }) => {
                  return <p className="mb-0 mt-0 whitespace-pre-wrap leading-relaxed">{processMarkdownChildren(children)}</p>;
                },
                ol: ({ children, ...props }) => {
                  return <ol className="list-decimal list-outside ml-6 space-y-4" {...props}>{children}</ol>;
                },
                ul: ({ children, ...props }) => {
                  return <ul className="list-disc list-outside ml-6 space-y-2" {...props}>{children}</ul>;
                },
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
                br: () => {
                  return <br className="my-1" />;
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
          );
        });

        MarkdownWithMath.displayName = 'MarkdownWithMath';
        setMarkdownComponent(() => MarkdownWithMath);
        setIsMarkdownLoaded(true);
      } catch (error) {
        console.error('Failed to load markdown components:', error);
        // Fallback to simple text rendering
        setIsMarkdownLoaded(true);
      }
    };

    loadMarkdown();
  }, []);

  if (!isMarkdownLoaded) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-muted rounded w-2/3"></div>
      </div>
    );
  }

  if (!MarkdownComponent) {
    // Fallback to simple text if markdown failed to load
    return (
      <div className="whitespace-pre-wrap">
        {content}
      </div>
    );
  }

  return <MarkdownComponent>{content}</MarkdownComponent>;
});

LazyMarkdownRenderer.displayName = 'LazyMarkdownRenderer';

// Virtualized chunk component that only renders when visible
const VirtualizedChunk = memo(({ 
  chunk, 
  chunkIndex, 
  isVisible 
}: { 
  chunk: string; 
  chunkIndex: number;
  isVisible: boolean;
}) => {
  if (!isVisible) {
    // Render placeholder of estimated height
    const estimatedHeight = Math.max(100, chunk.length / 5);
    return (
      <div 
        key={`placeholder-${chunkIndex}`}
        style={{ height: estimatedHeight }}
        className="bg-muted/10 rounded animate-pulse"
      />
    );
  }

  return (
    <div key={`chunk-${chunkIndex}`} className="chunk-content p-0 m-0">
      <LazyMarkdownRenderer content={chunk} />
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.chunk === nextProps.chunk && 
         prevProps.chunkIndex === nextProps.chunkIndex &&
         prevProps.isVisible === nextProps.isVisible;
});

VirtualizedChunk.displayName = 'VirtualizedChunk';

// Intersection Observer hook for virtualization
function useIntersectionObserver(options?: IntersectionObserverInit) {
  const [visibleChunks, setVisibleChunks] = useState<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Map<number, Element>>(new Map());

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      setVisibleChunks(prev => {
        const newVisible = new Set(prev);
        entries.forEach(entry => {
          const chunkIndex = parseInt(entry.target.getAttribute('data-chunk-index') || '0');
          if (entry.isIntersecting) {
            newVisible.add(chunkIndex);
          } else {
            newVisible.delete(chunkIndex);
          }
        });
        return newVisible;
      });
    }, {
      rootMargin: '100px 0px', // Load chunks 100px before they come into view
      threshold: 0.1,
      ...options
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const observeElement = (element: Element, chunkIndex: number) => {
    if (observerRef.current && element) {
      element.setAttribute('data-chunk-index', chunkIndex.toString());
      observerRef.current.observe(element);
      elementsRef.current.set(chunkIndex, element);
    }
  };

  const unobserveElement = (chunkIndex: number) => {
    const element = elementsRef.current.get(chunkIndex);
    if (observerRef.current && element) {
      observerRef.current.unobserve(element);
      elementsRef.current.delete(chunkIndex);
    }
  };

  return { visibleChunks, observeElement, unobserveElement };
}

export const OptimizedResponse = memo(
  ({ children, className }: OptimizedResponseProps) => {
    const chunks = useChunkedContent(children);
    const { visibleChunks, observeElement } = useIntersectionObserver();
    
    return (
      <div
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          // 移除chunk之间的间距
          '[&_.chunk-content:not(:first-child)>*:first-child]:!mt-0',
          '[&_.chunk-content:not(:last-child)>*:last-child]:!mb-0',
          '[&_.katex]:!mx-1',
          '[&_.katex-display]:!my-8',
          '[&_p:has(.katex)]:!my-6',
          '[&_p]:!leading-relaxed',
          '[&_p]:!my-2',
          '[&_ol]:mb-4',
          '[&_ul]:mb-4',
          '[&_li]:mb-3',
          '[&_li_p]:mb-2',
          '[&_li>p:last-child]:mb-0',
          className,
        )}
      >
        {chunks.map((chunk, index) => (
          <div
            key={`chunk-container-${index}`}
            className="m-0 p-0"
            ref={(el) => {
              if (el) {
                observeElement(el, index);
              }
            }}
          >
            <VirtualizedChunk
              chunk={chunk}
              chunkIndex={index}
              isVisible={visibleChunks.has(index) || index === 0} // Always render first chunk
            />
          </div>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    const lengthDiff = Math.abs(prevProps.children.length - nextProps.children.length);
    return lengthDiff === 0 || (lengthDiff < 100 && prevProps.children === nextProps.children);
  },
);

OptimizedResponse.displayName = 'OptimizedResponse';
