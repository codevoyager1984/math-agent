'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Stack,
  Group,
  Button,
  Text,
  SimpleGrid,
  LoadingOverlay,
  Pagination,
} from '@mantine/core';
import { 
  IconRefresh, 
  IconTrash,
  IconPlus,
  IconFileUpload,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import { toast } from 'sonner';
import { modals } from '@mantine/modals';
import PageHeader from '@/components/PageHeader/PageHeader';
import KnowledgePointCard from '@/components/knowledge-base/KnowledgePointCard';
import KnowledgePointDetailModal from '@/components/knowledge-base/KnowledgePointDetailModal';
import SearchFilters from '@/components/knowledge-base/SearchFilters';
import KnowledgeBaseStats from '@/components/knowledge-base/KnowledgeBaseStats';
import DocumentUploadModal from '@/components/knowledge-base/DocumentUploadModal';
import {
  getKnowledgePoints,
  deleteKnowledgePoint,
  getCollectionInfo,
  clearKnowledgeBase,
  queryDocuments,
  KnowledgePoint,
  KnowledgePointListParams,
  QueryParams,
} from '@/api/knowledge';
import { PATH_KNOWLEDGE_BASE } from '@/routes';
import {
  loadSearchConfig,
  saveSearchConfig,
  resetSearchConfig,
  type SearchConfig
} from '@/utils/searchConfig';

const RECORDS_PER_PAGE = 12;

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgePoint | null>(null);
  const [collectionInfo, setCollectionInfo] = useState<any>(null);

  // 搜索状态管理
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // 混合搜索状态 - 从 localStorage 初始化
  const [searchMode, setSearchMode] = useState<'vector' | 'text' | 'hybrid'>('hybrid');
  const [vectorWeight, setVectorWeight] = useState(0.6);
  const [textWeight, setTextWeight] = useState(0.4);
  const [enableRerank, setEnableRerank] = useState(true);
  const [rerankTopK, setRerankTopK] = useState<number | undefined>(undefined);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Modal states
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [uploadOpened, { open: openUpload, close: closeUpload }] = useDisclosure(false);

  // 初始化时从 localStorage 加载配置
  useEffect(() => {
    const savedConfig = loadSearchConfig();
    setSearchMode(savedConfig.searchMode);
    setVectorWeight(savedConfig.vectorWeight);
    setTextWeight(savedConfig.textWeight);
    setEnableRerank(savedConfig.enableRerank);
    setRerankTopK(savedConfig.rerankTopK);
    setIsConfigLoaded(true);
  }, []);

  // 配置变化时自动保存到 localStorage
  useEffect(() => {
    if (isConfigLoaded) {
      const config: SearchConfig = {
        searchMode,
        vectorWeight,
        textWeight,
        enableRerank,
        rerankTopK,
      };
      saveSearchConfig(config);
    }
  }, [searchMode, vectorWeight, textWeight, enableRerank, rerankTopK, isConfigLoaded]);

  // 获取知识点列表（默认列表，不包含搜索）
  const fetchKnowledgePointsList = useCallback(async () => {
    try {
      setLoading(true);

      // 使用传统的分页获取
      const params: KnowledgePointListParams = {
        page,
        limit: RECORDS_PER_PAGE,
      };

      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }

      const response = await getKnowledgePoints(params);
      setKnowledgePoints(response.knowledge_points);
      setTotalRecords(response.total);
    } catch (error) {
      console.error('获取知识点列表失败:', error);
      toast.error('获取知识点列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter]);

  // 执行搜索
  const executeSearch = useCallback(async (searchQuery: string) => {
    try {
      setLoading(true);

      if (searchQuery.trim()) {
        const queryParams: QueryParams = {
          query: searchQuery.trim(),
          n_results: RECORDS_PER_PAGE,
          search_mode: searchMode,
          vector_weight: vectorWeight,
          text_weight: textWeight,
          enable_rerank: enableRerank,
          rerank_top_k: rerankTopK,
        };

        const response = await queryDocuments(queryParams);

        // 转换查询结果为知识点格式
        const knowledgePointResults = response.results.map((result) => {
          const metadata = result.metadata || {};
          return {
            id: result.id,
            title: metadata.title || '',
            description: metadata.description || '',
            category: metadata.category || 'general',
            examples: metadata.examples || [],
            tags: metadata.tags || [],
            created_at: metadata.created_at,
            updated_at: metadata.updated_at,
            similarity_score: result.final_score || result.vector_score || (1 - result.distance),
          } as KnowledgePoint;
        }).filter(kp => {
          // 应用分类过滤
          return categoryFilter === 'all' || kp.category === categoryFilter;
        });

        setKnowledgePoints(knowledgePointResults);
        setTotalRecords(knowledgePointResults.length);
      } else {
        // 如果搜索词为空，回到正常列表
        await fetchKnowledgePointsList();
      }
    } catch (error) {
      console.error('搜索失败:', error);
      toast.error('搜索失败');
    } finally {
      setLoading(false);
    }
  }, [searchMode, vectorWeight, textWeight, enableRerank, rerankTopK, categoryFilter, fetchKnowledgePointsList]);

  // 获取集合信息
  const fetchCollectionInfo = useCallback(async () => {
    try {
      const info = await getCollectionInfo();
      setCollectionInfo(info);
    } catch (error) {
      console.error('获取集合信息失败:', error);
    }
  }, []);

  // 初始加载和分页、分类变化时获取数据（非搜索模式）
  useEffect(() => {
    if (!isSearchMode) {
      fetchKnowledgePointsList();
    }
  }, [fetchKnowledgePointsList, isSearchMode]);

  useEffect(() => {
    fetchCollectionInfo();
  }, [fetchCollectionInfo]);

  // 搜索处理
  const handleSearch = async () => {
    const query = search.trim();
    if (query) {
      setIsSearchMode(true);
      setLastSearchQuery(query);
      setPage(1); // 重置到第一页
      await executeSearch(query);
    } else {
      // 如果搜索词为空，退出搜索模式
      setIsSearchMode(false);
      setLastSearchQuery('');
      setPage(1);
      await fetchKnowledgePointsList();
    }
  };

  // 重置搜索
  const handleReset = async () => {
    setSearch('');
    setCategoryFilter('all');
    setIsSearchMode(false);
    setLastSearchQuery('');
    setPage(1);
    await fetchKnowledgePointsList();
  };

  // 重置配置到默认值
  const handleResetConfig = () => {
    const defaultConfig = resetSearchConfig();
    setSearchMode(defaultConfig.searchMode);
    setVectorWeight(defaultConfig.vectorWeight);
    setTextWeight(defaultConfig.textWeight);
    setEnableRerank(defaultConfig.enableRerank);
    setRerankTopK(defaultConfig.rerankTopK);
  };

  // 查看知识点详情
  const handleViewDetail = (knowledgePoint: KnowledgePoint) => {
    setSelectedKnowledge(knowledgePoint);
    openDetail();
  };

  // 编辑知识点
  const handleEdit = (id: string) => {
    router.push(PATH_KNOWLEDGE_BASE.edit(id));
  };

  // 创建知识点
  const handleCreate = () => {
    router.push('/dashboard/knowledge-base/create');
  };

  // 删除知识点
  const handleDelete = (knowledgePoint: KnowledgePoint) => {
    modals.openConfirmModal({
      title: '删除知识点',
      children: (
        <Text size="sm">
          确定要删除知识点 <strong>{knowledgePoint.title}</strong> 吗？此操作不可恢复。
        </Text>
      ),
      labels: { confirm: '删除', cancel: '取消' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteKnowledgePoint(knowledgePoint.id);
          toast.success('知识点删除成功');
          // 根据当前模式刷新列表
          if (isSearchMode && lastSearchQuery) {
            executeSearch(lastSearchQuery);
          } else {
            fetchKnowledgePointsList();
          }
          fetchCollectionInfo(); // 刷新集合信息
        } catch (error) {
          console.error('删除知识点失败:', error);
          toast.error('删除知识点失败');
        }
      },
    });
  };

  // 清空知识库
  const handleClearKnowledgeBase = () => {
    modals.openConfirmModal({
      title: '清空知识库',
      children: (
        <Stack gap="md">
          <Text size="sm" c="red">
            <strong>⚠️ 危险操作</strong>
          </Text>
          <Text size="sm">
            确定要清空整个知识库吗？这将删除所有知识点数据，此操作不可恢复。
          </Text>
        </Stack>
      ),
      labels: { confirm: '确认清空', cancel: '取消' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await clearKnowledgeBase();
          toast.success('知识库清空成功');
          // 根据当前模式刷新列表
          if (isSearchMode && lastSearchQuery) {
            executeSearch(lastSearchQuery);
          } else {
            fetchKnowledgePointsList();
          }
          fetchCollectionInfo(); // 刷新集合信息
        } catch (error) {
          console.error('清空知识库失败:', error);
          toast.error('清空知识库失败');
        }
      },
    });
  };

  // 文档上传成功处理
  const handleUploadSuccess = () => {
    // 根据当前模式刷新列表
    if (isSearchMode && lastSearchQuery) {
      executeSearch(lastSearchQuery);
    } else {
      fetchKnowledgePointsList();
    }
    fetchCollectionInfo(); // 刷新集合信息
    closeUpload();
  };

  return (
    <Container fluid>
      <Stack gap="lg">
        <PageHeader title="知识库管理" />

        {/* 统计信息 */}
        <KnowledgeBaseStats collectionInfo={collectionInfo} />

        {/* 搜索和筛选 */}
        <SearchFilters
          search={search}
          categoryFilter={categoryFilter}
          searchMode={searchMode}
          vectorWeight={vectorWeight}
          textWeight={textWeight}
          enableRerank={enableRerank}
          rerankTopK={rerankTopK}
          onSearchChange={setSearch}
          onCategoryChange={setCategoryFilter}
          onSearchModeChange={setSearchMode}
          onVectorWeightChange={setVectorWeight}
          onTextWeightChange={setTextWeight}
          onEnableRerankChange={setEnableRerank}
          onRerankTopKChange={setRerankTopK}
          onSearch={handleSearch}
          onReset={handleReset}
          onResetConfig={handleResetConfig}
        />

        {/* 操作栏 */}
        <Group justify="space-between">
          <Group gap="sm">
            <Text size="sm" c="dimmed">
              共 {totalRecords} 个知识点
            </Text>
          </Group>
          <Group gap="sm">
            <Button 
              leftSection={<IconPlus size={16} />}
              onClick={handleCreate}
            >
              创建知识点
            </Button>
            <Button
              leftSection={<IconFileUpload size={16} />}
              onClick={openUpload}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
            >
              上传文档
            </Button>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => {
                if (isSearchMode && lastSearchQuery) {
                  executeSearch(lastSearchQuery);
                } else {
                  fetchKnowledgePointsList();
                }
              }}
            >
              刷新
            </Button>
            <Button
              variant="outline"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={handleClearKnowledgeBase}
            >
              清空知识库
            </Button>
          </Group>
        </Group>

        {/* 知识点网格 */}
        <div style={{ position: 'relative' }}>
          <LoadingOverlay visible={loading} />
          {knowledgePoints.length === 0 && !loading ? (
            <Text ta="center" c="dimmed" py="xl">
              暂无知识点数据，点击"创建知识点"开始添加
            </Text>
          ) : (
            <>
              <SimpleGrid 
                cols={{ base: 1, sm: 2, md: 3, lg: 4 }} 
                spacing="md"
              >
                {knowledgePoints.map((knowledgePoint) => (
                  <KnowledgePointCard
                    key={knowledgePoint.id}
                    knowledgePoint={knowledgePoint}
                    onView={handleViewDetail}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </SimpleGrid>

              {/* 分页 */}
              {Math.ceil(totalRecords / RECORDS_PER_PAGE) > 1 && (
                <Group justify="center" mt="lg">
                  <Pagination
                    value={page}
                    onChange={setPage}
                    total={Math.ceil(totalRecords / RECORDS_PER_PAGE)}
                  />
                </Group>
              )}
            </>
          )}
        </div>

        {/* 知识点详情弹窗 */}
        <KnowledgePointDetailModal
          opened={detailOpened}
          onClose={closeDetail}
          knowledgePoint={selectedKnowledge}
        />

        {/* 文档上传弹窗 */}
        <DocumentUploadModal
          opened={uploadOpened}
          onClose={closeUpload}
          onSuccess={handleUploadSuccess}
        />
      </Stack>
    </Container>
  );
}
