'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpenIcon, 
  TagIcon, 
  LoaderIcon, 
  AlertCircleIcon, 
  ArrowLeftIcon,
  CalendarIcon,
  LayersIcon,
  FileTextIcon,
  CopyIcon,
  CheckIcon
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { OptimizedResponse } from '../elements/optimized-response';
import { KnowledgePoint, getKnowledgePoint } from '@/lib/knowledge-api';

interface KnowledgeDetailPageProps {
  knowledgeId: string;
}

export function KnowledgeDetailPage({ knowledgeId }: KnowledgeDetailPageProps) {
  const [knowledgePoint, setKnowledgePoint] = useState<KnowledgePoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 加载知识点数据
  useEffect(() => {
    const loadKnowledgePoint = async () => {
      try {
        setLoading(true);
        setError(null);
        const point = await getKnowledgePoint(knowledgeId);
        setKnowledgePoint(point);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载知识点详情失败');
      } finally {
        setLoading(false);
      }
    };

    loadKnowledgePoint();
  }, [knowledgeId]);

  // 复制知识点内容
  const copyKnowledgePoint = async () => {
    if (!knowledgePoint) return;

    try {
      let content = `# ${knowledgePoint.title}\n\n`;
      content += `**分类**: ${knowledgePoint.category}\n\n`;
      content += `**描述**:\n${knowledgePoint.description}\n\n`;
      
      if (knowledgePoint.tags.length > 0) {
        content += `**标签**: ${knowledgePoint.tags.join(', ')}\n\n`;
      }
      
      if (knowledgePoint.examples.length > 0) {
        content += `**相关例题**:\n\n`;
        knowledgePoint.examples.forEach((example, index) => {
          content += `**例题 ${index + 1}** (难度: ${example.difficulty}):\n`;
          content += `${example.question}\n\n`;
          content += `**解答思路**: ${example.solution}\n\n`;
        });
      }

      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-muted-foreground">
            <LoaderIcon className="size-8 animate-spin" />
            <span className="text-lg">加载中...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center gap-3 text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-6 mb-6">
            <AlertCircleIcon className="size-8" />
            <span className="text-lg">{error}</span>
          </div>
          <Link href="/knowledge">
            <Button variant="outline">
              <ArrowLeftIcon className="size-4" />
              返回知识库
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!knowledgePoint) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          <BookOpenIcon className="size-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            知识点不存在
          </h3>
          <p className="text-muted-foreground mb-6">
            请检查链接是否正确或知识点是否已被删除
          </p>
          <Link href="/knowledge">
            <Button variant="outline">
              <ArrowLeftIcon className="size-4" />
              返回知识库
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 面包屑导航 */}
      <div className="mb-6">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link 
            href="/knowledge" 
            className="hover:text-foreground transition-colors"
          >
            知识库
          </Link>
          <span>•</span>
          <span className="text-foreground font-medium">知识点详情</span>
        </nav>
      </div>

      {/* 返回按钮 */}
      <div className="mb-6">
        <Link href="/knowledge">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="size-4" />
            返回列表
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 主要内容 */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <BookOpenIcon className="size-6 text-blue-600" />
                      <Badge variant="secondary">{knowledgePoint.category}</Badge>
                    </div>
                    <CardTitle className="text-2xl mb-4">
                      {knowledgePoint.title}
                    </CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyKnowledgePoint}
                    className="shrink-0"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="size-4 text-green-600" />
                        已复制
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-4" />
                        复制
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <OptimizedResponse className="text-sm leading-relaxed">
                    {knowledgePoint.description}
                  </OptimizedResponse>
                </div>
              </CardContent>
            </Card>

            {/* 例题部分 */}
            {knowledgePoint.examples.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileTextIcon className="size-5" />
                    相关例题 ({knowledgePoint.examples.length} 道)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {knowledgePoint.examples.map((example, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-l-orange-400"
                      >
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold text-base mb-2 flex items-center gap-2">
                              例题 {index + 1}
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
                            </h4>
                            <div className="bg-white dark:bg-gray-900 p-4 rounded border">
                              <OptimizedResponse className="text-sm">
                                {example.question}
                              </OptimizedResponse>
                            </div>
                          </div>
                          
                          <div>
                            <h5 className="font-medium text-sm mb-2 text-muted-foreground">
                              解答思路:
                            </h5>
                            <div className="bg-white dark:bg-gray-900 p-4 rounded border">
                              <OptimizedResponse className="text-sm">
                                {example.solution}
                              </OptimizedResponse>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>

        {/* 侧边栏信息 */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {/* 基本信息 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LayersIcon className="size-5" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {knowledgePoint.created_at && (
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">创建时间</p>
                      <p className="text-sm">
                        {new Date(knowledgePoint.created_at).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )}
                
                {knowledgePoint.updated_at && knowledgePoint.updated_at !== knowledgePoint.created_at && (
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">更新时间</p>
                      <p className="text-sm">
                        {new Date(knowledgePoint.updated_at).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground font-mono">
                    ID: {knowledgePoint.id}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 标签 */}
            {knowledgePoint.tags.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TagIcon className="size-5" />
                    相关标签
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {knowledgePoint.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 统计信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">统计信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">例题数量</span>
                  <span className="text-sm font-medium">
                    {knowledgePoint.examples.length} 道
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">标签数量</span>
                  <span className="text-sm font-medium">
                    {knowledgePoint.tags.length} 个
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">内容长度</span>
                  <span className="text-sm font-medium">
                    {knowledgePoint.description.length} 字符
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
