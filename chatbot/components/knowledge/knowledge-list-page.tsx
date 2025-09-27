'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, BookOpenIcon, FilterIcon, LoaderIcon, AlertCircleIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, TrendingUpIcon } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { OptimizedResponse } from '../elements/optimized-response';
import { KnowledgePoint, getKnowledgePoints, searchKnowledgePoints } from '@/lib/knowledge-api';

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
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-lg line-clamp-2">
                    {knowledgePoint.title}
                  </CardTitle>
                  {knowledgePoint.relevanceScore !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <TrendingUpIcon className="size-3" />
                      <span>相似度: {Math.max(0, knowledgePoint.relevanceScore).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);

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

  // 从知识点中提取标签
  const extractTags = (points: KnowledgePoint[]) => {
    const tagSet = new Set<string>();
    points.forEach(point => {
      if (point.tags && point.tags.length > 0) {
        point.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  };

  // 加载知识点数据
  const loadKnowledgePoints = async (page = 1, search = '', category = '', tag = '') => {
    try {
      setLoading(true);
      setError(null);

      let response;
      let filteredPoints: KnowledgePoint[] = [];
      let totalCount = 0;

      if (search.trim()) {
        // 如果有搜索查询，使用 /query 接口进行智能搜索
        const searchResults = await searchKnowledgePoints(search, {
          n_results: 50, // 获取更多结果用于分页
          search_mode: 'hybrid'
        });

        // 应用分类筛选
        let searchFilteredPoints = searchResults;
        if (category) {
          searchFilteredPoints = searchResults.filter(point => point.category === category);
        }

        // 应用标签筛选
        if (tag) {
          searchFilteredPoints = searchFilteredPoints.filter(point => 
            point.tags && point.tags.includes(tag)
          );
        }

        filteredPoints = searchFilteredPoints;
        totalCount = searchFilteredPoints.length;

        // 前端分页处理
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedPoints = filteredPoints.slice(startIndex, endIndex);
        
        setKnowledgePoints(paginatedPoints);
        setTotalCount(totalCount);
        setTotalPages(Math.ceil(totalCount / pageSize));

      } else {
        // 没有搜索查询，使用 /documents 接口进行分页获取
        const limit = tag ? pageSize * 5 : pageSize;
        
        response = await getKnowledgePoints({
          page,
          limit,
          category: category || undefined,
        });

        filteredPoints = response.knowledge_points;

        // 如果有标签筛选，在前端进行筛选
        if (tag) {
          filteredPoints = response.knowledge_points.filter(point => 
            point.tags && point.tags.includes(tag)
          );
        }

        // 如果使用了标签筛选，需要重新计算分页
        if (tag) {
          // 前端分页处理
          const startIndex = (page - 1) * pageSize;
          const endIndex = startIndex + pageSize;
          const paginatedPoints = filteredPoints.slice(startIndex, endIndex);
          
          setKnowledgePoints(paginatedPoints);
          setTotalCount(filteredPoints.length);
          setTotalPages(Math.ceil(filteredPoints.length / pageSize));
        } else {
          // 后端分页，直接使用返回的数据
          setKnowledgePoints(filteredPoints);
          setTotalCount(response.total || filteredPoints.length);
          setTotalPages(Math.ceil((response.total || filteredPoints.length) / pageSize));
        }
      }
      
      // 提取分类和标签（仅在首次加载时且无搜索时）
      if (page === 1 && !search && !category && !tag && response) {
        setCategories(extractCategories(response.knowledge_points));
        setTags(extractTags(response.knowledge_points));
        // 重置标签展开状态
        setShowAllTags(false);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '加载知识点失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 当防抖后的搜索词改变时触发搜索
  useEffect(() => {
    // 跳过初始化时的调用
    if (debouncedSearchQuery === '' && searchQuery === '' && selectedCategory === '' && selectedTag === '') {
      return;
    }
    setCurrentPage(1);
    loadKnowledgePoints(1, debouncedSearchQuery, selectedCategory, selectedTag);
  }, [debouncedSearchQuery]);

  // 处理搜索输入
  const handleSearchInput = (query: string) => {
    setSearchQuery(query);
  };

  // 处理分类筛选
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    // 重置标签展开状态
    setShowAllTags(false);
    // 直接调用加载函数，不需要等待防抖
    loadKnowledgePoints(1, debouncedSearchQuery, category, selectedTag);
  };

  // 处理标签筛选
  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    setCurrentPage(1);
    // 直接调用加载函数，不需要等待防抖
    loadKnowledgePoints(1, debouncedSearchQuery, selectedCategory, tag);
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadKnowledgePoints(page, debouncedSearchQuery, selectedCategory, selectedTag);
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="搜索知识点..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* 分类筛选 */}
          {categories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">按分类筛选：</h3>
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
            </div>
          )}

          {/* 标签筛选 */}
          {tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">按标签筛选：</h3>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedTag === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTagChange('')}
                >
                  全部标签
                </Button>
                
                {/* 始终显示的前8个标签 */}
                {tags.slice(0, 8).map((tag) => (
                  <Button
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTagChange(tag)}
                  >
                    {tag}
                  </Button>
                ))}
                
                {/* 展开时显示的额外标签 */}
                <AnimatePresence>
                  {showAllTags && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="flex gap-2 flex-wrap"
                    >
                      {tags.slice(8).map((tag) => (
                        <Button
                          key={tag}
                          variant={selectedTag === tag ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleTagChange(tag)}
                        >
                          {tag}
                        </Button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* 展开/收起按钮 */}
                {tags.length > 8 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs px-3 py-1 h-8 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    onClick={() => setShowAllTags(!showAllTags)}
                  >
                    {showAllTags ? (
                      <>
                        <ChevronUpIcon className="size-3 mr-1" />
                        收起标签
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon className="size-3 mr-1" />
                        +{tags.length - 8} 个标签
                      </>
                    )}
                  </Button>
                )}
              </div>
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
            {debouncedSearchQuery || selectedCategory || selectedTag ? '未找到相关知识点' : '暂无知识点'}
          </h3>
          <p className="text-muted-foreground">
            {debouncedSearchQuery || selectedCategory || selectedTag
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
              {debouncedSearchQuery && ` · 搜索关键词: "${debouncedSearchQuery}"`}
              {selectedCategory && ` · 分类: ${selectedCategory}`}
              {selectedTag && ` · 标签: ${selectedTag}`}
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
