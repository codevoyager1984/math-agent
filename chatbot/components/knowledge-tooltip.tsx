'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpenIcon, TagIcon, LoaderIcon, AlertCircleIcon, XIcon } from 'lucide-react';
import { Badge } from './ui/badge';
import { useTranslation } from 'react-i18next';
import { Response } from './elements/response';

interface KnowledgePoint {
  id: string;
  title: string;
  description: string;
  category: string;
  examples: Array<{
    question: string;
    solution: string;
    difficulty: string;
  }>;
  tags: string[];
}

interface KnowledgeTooltipProps {
  knowledgeId: string;
  displayText: string;
}

// 模拟知识点缓存
const knowledgeCache = new Map<string, KnowledgePoint>();

export function KnowledgeTooltip({ knowledgeId, displayText }: KnowledgeTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [knowledge, setKnowledge] = useState<KnowledgePoint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const spanRef = useRef<HTMLSpanElement>(null);
  const { t } = useTranslation();

  const fetchKnowledgePoint = async (id: string) => {
    // 检查缓存
    if (knowledgeCache.has(id)) {
      setKnowledge(knowledgeCache.get(id)!);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ragServerUrl = process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000';
      const response = await fetch(`${ragServerUrl}/api/knowledge-base/documents/${id}`);
      
      if (!response.ok) {
        throw new Error(t('knowledge.knowledgePointNotFound'));
      }

      const data = await response.json();
      const knowledgePoint: KnowledgePoint = {
        id: data.id,
        title: data.title,
        description: data.description,
        category: data.category,
        examples: data.examples || [],
        tags: data.tags || []
      };

      // 缓存结果
      knowledgeCache.set(id, knowledgePoint);
      setKnowledge(knowledgePoint);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToFetchKnowledge'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    setIsOpen(true);
    if (!knowledge && !isLoading && !error) {
      fetchKnowledgePoint(knowledgeId);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!knowledge && !isLoading && !error) {
      fetchKnowledgePoint(knowledgeId);
    }
    
    // Calculate tooltip position
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      // Calculate position with viewport bounds checking
      const tooltipWidth = 320; // w-80 = 20rem = 320px
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let x = rect.left + scrollX + rect.width / 2;
      let y = rect.bottom + scrollY + 8;
      
      // Adjust horizontal position if tooltip would overflow
      if (x + tooltipWidth / 2 > viewportWidth) {
        x = viewportWidth - tooltipWidth / 2 - 16; // 16px margin
      } else if (x - tooltipWidth / 2 < 0) {
        x = tooltipWidth / 2 + 16; // 16px margin
      }
      
      // Adjust vertical position if tooltip would overflow
      if (y + 384 > viewportHeight) { // max-h-96 = 384px
        y = rect.top + scrollY - 8; // Show above the element
      }
      
      setTooltipPosition({ x, y });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <>
      <span
        ref={spanRef}
        className="inline-block px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-300 dark:border-blue-700"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {displayText}
      </span>

      {/* Hover tooltip - rendered as portal */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {isHovered && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed z-[9999] w-80 max-w-[90vw]"
              style={{
                left: `${tooltipPosition.x}px`,
                top: `${tooltipPosition.y}px`,
                transform: 'translateX(-50%)'
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={handleMouseLeave}
            >
              <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 p-4 backdrop-blur-sm max-h-96 overflow-y-auto">
                {isLoading && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <LoaderIcon className="size-4 animate-spin" />
                    <span className="text-sm">加载中...</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircleIcon className="size-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {knowledge && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                        {knowledge.title}
                      </h3>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        <Response className="text-xs">
                          {knowledge.description}
                        </Response>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {knowledge.category}
                      </Badge>
                      {knowledge.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p 
                        className="text-xs text-blue-600 dark:text-blue-400 font-medium cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        onClick={handleClick}
                      >
                        💡 点击查看详细内容和例题
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-[10000]"
              onClick={handleClose}
            />
            
            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed right-0 top-0 h-full w-[28rem] max-w-[90vw] bg-white dark:bg-gray-900 shadow-2xl z-[10001] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <BookOpenIcon className="size-6 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">知识点详情</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <XIcon className="size-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {isLoading && (
                  <div className="flex items-center gap-3 p-8 text-gray-600 dark:text-gray-400">
                    <LoaderIcon className="size-6 animate-spin" />
                    <span className="text-lg">加载中...</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 p-6 text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <AlertCircleIcon className="size-6" />
                    <span className="text-lg">{error}</span>
                  </div>
                )}

                {knowledge && (
                  <div className="space-y-6">
                    {/* Title and Description */}
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        {knowledge.title}
                      </h3>
                      <div className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                        <Response className="text-lg">
                          {knowledge.description}
                        </Response>
                      </div>
                    </div>

                    {/* Category and Tags */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        分类标签
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-sm px-3 py-1">
                          {knowledge.category}
                        </Badge>
                        {knowledge.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-sm px-3 py-1">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Examples */}
                    {knowledge.examples.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          相关例题
                        </h4>
                        <div className="space-y-4">
                          {knowledge.examples.map((example, index) => (
                            <div
                              key={index}
                              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3"
                            >
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  例题 {index + 1}:
                                </span>
                                <div className="mt-1 text-gray-900 dark:text-white">
                                  <Response className="text-sm">
                                    {example.question}
                                  </Response>
                                </div>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  解答:
                                </span>
                                <div className="mt-1 text-gray-700 dark:text-gray-300">
                                  <Response className="text-sm">
                                    {example.solution}
                                  </Response>
                                </div>
                              </div>
                              <div>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    example.difficulty === '简单' 
                                      ? 'border-green-300 text-green-700 dark:border-green-600 dark:text-green-400'
                                      : example.difficulty === '中等'
                                      ? 'border-yellow-300 text-yellow-700 dark:border-yellow-600 dark:text-yellow-400'
                                      : 'border-red-300 text-red-700 dark:border-red-600 dark:text-red-400'
                                  }`}
                                >
                                  难度: {example.difficulty}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Knowledge ID */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 font-mono">
                        知识点ID: {knowledge.id}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
