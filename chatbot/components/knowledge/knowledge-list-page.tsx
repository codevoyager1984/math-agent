'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SearchIcon, BookOpenIcon, FilterIcon, LoaderIcon, AlertCircleIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { OptimizedResponse } from '../elements/optimized-response';
import { KnowledgePoint, getKnowledgePoints } from '@/lib/knowledge-api';

// 分页组件
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeftIcon className="size-4" />
        上一页
      </Button>

      {getVisiblePages().map((page, index) => (
        <Button
          key={index}
          variant={page === currentPage ? 'default' : 'outline'}
          size="sm"
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={typeof page !== 'number'}
          className="min-w-[40px]"
        >
          {page}
        </Button>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        下一页
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  );
}

// 知识点卡片组件
interface KnowledgePointCardProps {
  knowledgePoint: KnowledgePoint;
}

function KnowledgePointCard({ knowledgePoint }: KnowledgePointCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/knowledge/${knowledgePoint.id}`}>
        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500 hover:border-l-blue-600">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg line-clamp-2 mb-2">
                  {knowledgePoint.title}
                </CardTitle>
                <div className="text-sm text-muted-foreground line-clamp-3">
                  <OptimizedResponse className="text-sm">
                    {knowledgePoint.description}
                  </OptimizedResponse>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {knowledgePoint.category}
                </Badge>
                {knowledgePoint.examples.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {knowledgePoint.examples.length} 个例题
                  </Badge>
                )}
              </div>
              {knowledgePoint.created_at && (
                <span className="text-xs text-muted-foreground">
                  {new Date(knowledgePoint.created_at).toLocaleDateString('zh-CN')}
                </span>
              )}
            </div>
            {knowledgePoint.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-3">
                {knowledgePoint.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {knowledgePoint.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{knowledgePoint.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

// 主页面组件
export function KnowledgeListPage() {
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);

  const pageSize = 12;

  // 从知识点中提取分类
  const extractCategories = (points: KnowledgePoint[]) => {
    const categorySet = new Set<string>();
    points.forEach(point => {
      if (point.category) {
        categorySet.add(point.category);
      }
    });
    return Array.from(categorySet).sort();
  };

  // 加载知识点数据
  const loadKnowledgePoints = async (page = 1, search = '', category = '') => {
    try {
      setLoading(true);
      setError(null);

      const response = await getKnowledgePoints({
        page,
        limit: pageSize,
        search: search || undefined,
        category: category || undefined,
      });

      setKnowledgePoints(response.knowledge_points);
      setTotalCount(response.total);
      setTotalPages(Math.ceil(response.total / pageSize));
      
      // 提取分类（仅在首次加载时）
      if (page === 1 && !search && !category) {
        setCategories(extractCategories(response.knowledge_points));
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '加载知识点失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    loadKnowledgePoints(1, query, selectedCategory);
  };

  // 处理分类筛选
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    loadKnowledgePoints(1, searchQuery, category);
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadKnowledgePoints(page, searchQuery, selectedCategory);
  };

  // 初始化加载
  useEffect(() => {
    loadKnowledgePoints();
  }, []);

  // 统计信息
  const statsInfo = useMemo(() => {
    const examplesCount = knowledgePoints.reduce((sum, point) => sum + point.examples.length, 0);
    return {
      totalKnowledge: totalCount,
      totalExamples: examplesCount,
      categoriesCount: categories.length,
    };
  }, [knowledgePoints, totalCount, categories.length]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <BookOpenIcon className="size-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              数学知识库
            </h1>
            <p className="text-muted-foreground mt-1">
              浏览和搜索数学知识点，深入学习概念和例题
            </p>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BookOpenIcon className="size-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">知识点总数</p>
                  <p className="text-2xl font-semibold">{statsInfo.totalKnowledge}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FilterIcon className="size-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">分类数量</p>
                  <p className="text-2xl font-semibold">{statsInfo.categoriesCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <SearchIcon className="size-5 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">例题总数</p>
                  <p className="text-2xl font-semibold">{statsInfo.totalExamples}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="搜索知识点..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          {categories.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleCategoryChange('')}
              >
                全部分类
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCategoryChange(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <LoaderIcon className="size-6 animate-spin" />
            <span className="text-lg">加载中...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-6">
            <AlertCircleIcon className="size-6" />
            <span className="text-lg">{error}</span>
          </div>
        </div>
      )}

      {!loading && !error && knowledgePoints.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <BookOpenIcon className="size-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground mb-2">
            {searchQuery || selectedCategory ? '未找到相关知识点' : '暂无知识点'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery || selectedCategory
              ? '请尝试调整搜索关键词或筛选条件'
              : '知识库正在建设中，敬请期待'}
          </p>
        </div>
      )}

      {!loading && !error && knowledgePoints.length > 0 && (
        <>
          {/* 结果统计 */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              找到 {totalCount} 个知识点
              {searchQuery && ` · 搜索关键词: "${searchQuery}"`}
              {selectedCategory && ` · 分类: ${selectedCategory}`}
            </p>
          </div>

          {/* 知识点网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {knowledgePoints.map((point) => (
              <KnowledgePointCard key={point.id} knowledgePoint={point} />
            ))}
          </div>

          {/* 分页 */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
