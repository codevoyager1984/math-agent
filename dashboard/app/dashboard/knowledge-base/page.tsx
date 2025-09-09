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
  KnowledgePoint, 
  KnowledgePointListParams,
} from '@/api/knowledge';
import { PATH_KNOWLEDGE_BASE } from '@/routes';

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

  // Modal states
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [uploadOpened, { open: openUpload, close: closeUpload }] = useDisclosure(false);

  // 获取知识点列表
  const fetchKnowledgePoints = useCallback(async () => {
    try {
      setLoading(true);
      const params: KnowledgePointListParams = {
        page,
        limit: RECORDS_PER_PAGE,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

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
  }, [page, search, categoryFilter]);

  // 获取集合信息
  const fetchCollectionInfo = useCallback(async () => {
    try {
      const info = await getCollectionInfo();
      setCollectionInfo(info);
    } catch (error) {
      console.error('获取集合信息失败:', error);
    }
  }, []);

  // 初始加载和依赖更新时获取数据
  useEffect(() => {
    fetchKnowledgePoints();
  }, [fetchKnowledgePoints]);

  useEffect(() => {
    fetchCollectionInfo();
  }, [fetchCollectionInfo]);

  // 搜索处理
  const handleSearch = () => {
    setPage(1); // 重置到第一页
  };

  // 重置搜索
  const handleReset = () => {
    setSearch('');
    setCategoryFilter('all');
    setPage(1);
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
          fetchKnowledgePoints(); // 刷新列表
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
          fetchKnowledgePoints(); // 刷新列表
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
    fetchKnowledgePoints(); // 刷新列表
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
          onSearchChange={setSearch}
          onCategoryChange={setCategoryFilter}
          onSearch={handleSearch}
          onReset={handleReset}
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
              onClick={fetchKnowledgePoints}
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
