'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpenIcon, TagIcon, LoaderIcon, AlertCircleIcon } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

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
  children: React.ReactNode;
}

// 模拟知识点缓存
const knowledgeCache = new Map<string, KnowledgePoint>();

export function KnowledgeTooltip({ knowledgeId, displayText, children }: KnowledgeTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [knowledge, setKnowledge] = useState<KnowledgePoint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const response = await fetch(`${ragServerUrl}/api/embedding/knowledge-points/${id}`);
      
      if (!response.ok) {
        throw new Error('知识点不存在');
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
      setError(err instanceof Error ? err.message : '获取知识点失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseEnter = () => {
    setIsVisible(true);
    if (!knowledge && !isLoading && !error) {
      fetchKnowledgePoint(knowledgeId);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <div className="relative inline-block">
      <span
        className="inline-block px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-300 dark:border-blue-700"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleMouseEnter}
      >
        {displayText}
      </span>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-80 mt-2 left-1/2 transform -translate-x-1/2"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={handleMouseLeave}
          >
            <Card className="shadow-lg border-2 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BookOpenIcon className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm">知识点详情</CardTitle>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {isLoading && (
                  <div className="flex items-center gap-2 p-4 text-gray-600">
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                    <span className="text-sm">加载中...</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 dark:bg-red-950/20 rounded">
                    <AlertCircleIcon className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {knowledge && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-base mb-1">{knowledge.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {knowledge.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {knowledge.category}
                      </Badge>
                      {knowledge.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {knowledge.examples.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          相关例题:
                        </h4>
                        <div className="space-y-2">
                          {knowledge.examples.slice(0, 1).map((example, index) => (
                            <div
                              key={index}
                              className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs"
                            >
                              <div className="font-medium mb-1">
                                例题: {example.question}
                              </div>
                              <div className="text-gray-600 dark:text-gray-400">
                                解答: {example.solution.substring(0, 100)}
                                {example.solution.length > 100 && '...'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 pt-2 border-t">
                      知识点ID: {knowledge.id}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
