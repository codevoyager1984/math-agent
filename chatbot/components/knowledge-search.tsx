'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { SearchIcon, BookOpenIcon, TagIcon, LoaderIcon, TrendingUpIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

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
  relevanceScore: number;
}

interface KnowledgeSearchProps {
  query: string;
  knowledgePoints?: KnowledgePoint[];
  totalFound?: number;
  isSearching?: boolean;
  error?: string;
}

export const KnowledgeSearch = memo(function KnowledgeSearch({
  query,
  knowledgePoints = [],
  totalFound = 0,
  isSearching = false,
  error,
}: KnowledgeSearchProps) {
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      >
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <SearchIcon className="size-4" />
          <span className="text-sm">
            搜索知识点时出错: {error}
          </span>
        </div>
      </motion.div>
    );
  }

  if (isSearching) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20"
      >
        <LoaderIcon className="size-4 animate-spin text-blue-600" />
        <span className="text-sm text-blue-700 dark:text-blue-300">
          正在搜索相关知识点: &quot;{query}&quot;...
        </span>
      </motion.div>
    );
  }

  if (totalFound === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50"
      >
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <SearchIcon className="size-4" />
          <span className="text-sm">
            未找到与 &quot;{query}&quot; 相关的知识点
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300 mb-3">
        <BookOpenIcon className="size-4" />
        <span>找到 {totalFound} 个相关知识点</span>
      </div>

      {knowledgePoints.map((point, index) => (
        <motion.div
          key={point.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-lg">{point.title}</CardTitle>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <TrendingUpIcon className="size-3" />
                      <span>相似度: {Math.max(0, point.relevanceScore).toFixed(1)}%</span>
                    </div>
                  </div>
                  <CardDescription className="mt-1">
                    {point.description}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="ml-2">
                  {point.category}
                </Badge>
              </div>
              
              {point.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <TagIcon className="size-3 text-gray-500" />
                  <div className="flex gap-1 flex-wrap">
                    {point.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {point.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{point.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>

            {point.examples.length > 0 && (
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    相关例题:
                  </h4>
                  {point.examples.map((example, exampleIndex) => (
                    <div
                      key={exampleIndex}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border-l-2 border-l-orange-400"
                    >
                      <div className="text-sm">
                        <div className="font-medium mb-1">
                          例题 {exampleIndex + 1}:
                        </div>
                        <div className="text-gray-700 dark:text-gray-300 mb-2">
                          {example.question}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">解答思路:</span> {example.solution}
                        </div>
                        <Badge variant="outline" className="mt-1 text-xs">
                          难度: {example.difficulty}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
});
