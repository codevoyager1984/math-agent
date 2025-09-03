'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Stack,
  Group,
  Button,
  TextInput,
  Select,
  Badge,
  ActionIcon,
  Modal,
  LoadingOverlay,
  Text,
  Card,
  Grid,
  Divider,
  Box,
  Title,
  Textarea,
  NumberInput,
} from '@mantine/core';
import { 
  IconEye, 
  IconSearch, 
  IconRefresh, 
  IconEdit,
  IconTrash,
  IconPlus,
  IconBook,
  IconBulb,
  IconTag,
  IconMathFunction,
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import { useDisclosure } from '@mantine/hooks';
import { toast } from 'sonner';
import { modals } from '@mantine/modals';
import PageHeader from '@/components/PageHeader/PageHeader';
import { formatTimestamp } from '@/utils';
import { 
  getKnowledgePoints, 
  addKnowledgePoint,
  deleteKnowledgePoint,
  getCollectionInfo,
  clearKnowledgeBase,
  KnowledgePoint, 
  KnowledgePointInput,
  KnowledgePointListParams,
  KnowledgePointsResponse,
  Example
} from '@/api/knowledge';

const RECORDS_PER_PAGE = 20;

const difficultyColors = {
  easy: 'green',
  medium: 'orange', 
  hard: 'red'
};

const difficultyLabels = {
  easy: '简单',
  medium: '中等',
  hard: '困难'
};

export default function KnowledgeBasePage() {
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
  const [addOpened, { open: openAdd, close: closeAdd }] = useDisclosure(false);

  // Add form state
  const [addForm, setAddForm] = useState<KnowledgePointInput>({
    title: '',
    description: '',
    category: 'general',
    examples: [],
    tags: []
  });

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

  // 添加例题
  const addExample = () => {
    setAddForm(prev => ({
      ...prev,
      examples: [
        ...prev.examples,
        { question: '', solution: '', difficulty: 'medium' as const }
      ]
    }));
  };

  // 删除例题
  const removeExample = (index: number) => {
    setAddForm(prev => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index)
    }));
  };

  // 更新例题
  const updateExample = (index: number, field: keyof Example, value: string) => {
    setAddForm(prev => ({
      ...prev,
      examples: prev.examples.map((ex, i) => 
        i === index ? { ...ex, [field]: value } : ex
      )
    }));
  };

  // 添加标签
  const handleTagsChange = (value: string) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    setAddForm(prev => ({
      ...prev,
      tags
    }));
  };

  // 保存知识点
  const handleSaveKnowledge = async () => {
    try {
      if (!addForm.title.trim()) {
        toast.error('请输入知识点名称');
        return;
      }
      if (!addForm.description.trim()) {
        toast.error('请输入知识点描述');
        return;
      }

      await addKnowledgePoint(addForm);
      toast.success('知识点添加成功');
      closeAdd();
      
      // 重置表单
      setAddForm({
        title: '',
        description: '',
        category: 'general',
        examples: [],
        tags: []
      });
      
      fetchKnowledgePoints(); // 刷新列表
      fetchCollectionInfo(); // 刷新集合信息
    } catch (error) {
      console.error('添加知识点失败:', error);
      toast.error('添加知识点失败');
    }
  };

  const formatDate = (dateString?: string) => {
    return formatTimestamp.dateTime(dateString);
  };

  return (
    <Container fluid>
      <Stack gap="lg">
        <PageHeader title="知识库管理" />

        {/* 统计信息 */}
        {collectionInfo && (
          <Card withBorder p="md">
            <Group gap="xl">
              <Group gap="xs">
                <IconBook size={20} color="blue" />
                <Text size="sm" c="dimmed">总文档数量:</Text>
                <Text fw={500}>{collectionInfo.count}</Text>
              </Group>
              <Group gap="xs">
                <IconMathFunction size={20} color="green" />
                <Text size="sm" c="dimmed">集合名称:</Text>
                <Text fw={500}>{collectionInfo.name}</Text>
              </Group>
            </Group>
          </Card>
        )}

        {/* 搜索和筛选 */}
        <Card withBorder p="md">
          <Stack gap="md">
            <Group align="flex-end" gap="md">
              <TextInput
                label="搜索"
                placeholder="搜索知识点名称、描述或标签"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftSection={<IconSearch size={16} />}
                style={{ flex: 1, minWidth: 200 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
              <Select
                label="分类"
                placeholder="选择分类"
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value || 'all')}
                data={[
                  { value: 'all', label: '全部分类' },
                  { value: 'general', label: '通用' },
                  { value: 'algebra', label: '代数' },
                  { value: 'geometry', label: '几何' },
                  { value: 'calculus', label: '微积分' },
                  { value: 'statistics', label: '统计' },
                ]}
                style={{ minWidth: 120 }}
              />
              <Group gap="sm">
                <Button onClick={handleSearch} leftSection={<IconSearch size={16} />}>
                  搜索
                </Button>
                <Button variant="light" onClick={handleReset}>
                  重置
                </Button>
              </Group>
            </Group>
          </Stack>
        </Card>

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
              onClick={openAdd}
            >
              添加知识点
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

        {/* 知识点表格 */}
        <Card withBorder>
          <div style={{ position: 'relative' }}>
            <LoadingOverlay visible={loading} />
            <DataTable
              withTableBorder={false}
              records={knowledgePoints}
              totalRecords={totalRecords}
              recordsPerPage={RECORDS_PER_PAGE}
              page={page}
              onPageChange={setPage}
              columns={[
                {
                  accessor: 'title',
                  title: '知识点名称',
                  width: 200,
                  render: (record) => (
                    <Group gap="sm">
                      <IconBulb size={16} color="orange" />
                      <Stack gap={2}>
                        <Text size="sm" fw={500}>
                          {record.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          ID: {record.id.slice(0, 8)}...
                        </Text>
                      </Stack>
                    </Group>
                  ),
                },
                {
                  accessor: 'description',
                  title: '描述',
                  render: (record) => (
                    <Text size="sm" lineClamp={2}>
                      {record.description}
                    </Text>
                  ),
                },
                {
                  accessor: 'category',
                  title: '分类',
                  width: 100,
                  render: (record) => (
                    <Badge variant="light" color="blue">
                      {record.category === 'general' ? '通用' :
                       record.category === 'algebra' ? '代数' :
                       record.category === 'geometry' ? '几何' :
                       record.category === 'calculus' ? '微积分' :
                       record.category === 'statistics' ? '统计' : record.category}
                    </Badge>
                  ),
                },
                {
                  accessor: 'examples',
                  title: '例题数量',
                  width: 100,
                  textAlign: 'center',
                  render: (record) => (
                    <Badge variant="outline" color="green">
                      {record.examples.length} 题
                    </Badge>
                  ),
                },
                {
                  accessor: 'tags',
                  title: '标签',
                  width: 150,
                  render: (record) => (
                    <Group gap="xs">
                      {record.tags?.slice(0, 2).map((tag, index) => (
                        <Badge key={index} size="xs" variant="light">
                          {tag}
                        </Badge>
                      ))}
                      {record.tags && record.tags.length > 2 && (
                        <Text size="xs" c="dimmed">+{record.tags.length - 2}</Text>
                      )}
                    </Group>
                  ),
                },
                {
                  accessor: 'created_at',
                  title: '创建时间',
                  width: 160,
                  render: (record) => (
                    <Text size="sm" c="dimmed">
                      {formatDate(record.created_at)}
                    </Text>
                  ),
                },
                {
                  accessor: 'actions',
                  title: '操作',
                  width: 120,
                  textAlign: 'center',
                  render: (record) => (
                    <Group gap="xs" justify="center">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="sm"
                        onClick={() => handleViewDetail(record)}
                      >
                        <IconEye size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="sm"
                        onClick={() => handleDelete(record)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  ),
                },
              ]}
              striped
              highlightOnHover
              minHeight={400}
              noRecordsText="暂无知识点数据"
              loadingText="加载中..."
            />
          </div>
        </Card>

        {/* 知识点详情弹窗 */}
        <Modal
          opened={detailOpened}
          onClose={closeDetail}
          title="知识点详情"
          size="xl"
        >
          {selectedKnowledge && (
            <Stack gap="md">
              <Group align="flex-start" gap="md">
                <IconBulb size={40} color="orange" />
                <Stack gap="sm" style={{ flex: 1 }}>
                  <Title order={3}>{selectedKnowledge.title}</Title>
                  <Badge variant="light" color="blue">
                    {selectedKnowledge.category}
                  </Badge>
                </Stack>
              </Group>

              <Grid>
                <Grid.Col span={12}>
                  <Text size="sm" c="dimmed">描述</Text>
                  <Text>{selectedKnowledge.description}</Text>
                </Grid.Col>
                
                {selectedKnowledge.tags && selectedKnowledge.tags.length > 0 && (
                  <Grid.Col span={12}>
                    <Text size="sm" c="dimmed">标签</Text>
                    <Group gap="xs">
                      {selectedKnowledge.tags.map((tag, index) => (
                        <Badge key={index} variant="light" leftSection={<IconTag size={12} />}>
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  </Grid.Col>
                )}

                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">知识点ID</Text>
                  <Text style={{ wordBreak: 'break-all' }}>{selectedKnowledge.id}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">例题数量</Text>
                  <Text>{selectedKnowledge.examples.length} 题</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">创建时间</Text>
                  <Text>{formatDate(selectedKnowledge.created_at)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">更新时间</Text>
                  <Text>{formatDate(selectedKnowledge.updated_at)}</Text>
                </Grid.Col>
              </Grid>

              {selectedKnowledge.examples.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Text size="sm" fw={500} mb="sm">相关例题</Text>
                    <Stack gap="md">
                      {selectedKnowledge.examples.map((example, index) => (
                        <Card key={index} withBorder p="md">
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <Text size="sm" fw={500}>例题 {index + 1}</Text>
                              <Badge 
                                size="sm" 
                                color={difficultyColors[example.difficulty]}
                                variant="light"
                              >
                                {difficultyLabels[example.difficulty]}
                              </Badge>
                            </Group>
                            <Box>
                              <Text size="sm" c="dimmed">题目：</Text>
                              <Text size="sm">{example.question}</Text>
                            </Box>
                            <Box>
                              <Text size="sm" c="dimmed">解答：</Text>
                              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                                {example.solution}
                              </Text>
                            </Box>
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                </>
              )}
            </Stack>
          )}
        </Modal>

        {/* 添加知识点弹窗 */}
        <Modal
          opened={addOpened}
          onClose={closeAdd}
          title="添加知识点"
          size="lg"
        >
          <Stack gap="md">
            <TextInput
              label="知识点名称"
              placeholder="请输入知识点名称"
              required
              value={addForm.title}
              onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
            />
            
            <Textarea
              label="知识点描述"
              placeholder="请输入知识点的详细描述"
              required
              minRows={3}
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
            />
            
            <Select
              label="分类"
              placeholder="选择分类"
              value={addForm.category}
              onChange={(value) => setAddForm({ ...addForm, category: value || 'general' })}
              data={[
                { value: 'general', label: '通用' },
                { value: 'algebra', label: '代数' },
                { value: 'geometry', label: '几何' },
                { value: 'calculus', label: '微积分' },
                { value: 'statistics', label: '统计' },
              ]}
            />
            
            <TextInput
              label="标签"
              placeholder="请输入标签，用逗号分隔"
              value={addForm.tags?.join(', ') || ''}
              onChange={(e) => handleTagsChange(e.target.value)}
              description="例如：基础,重要,考试重点"
            />

            <Divider />

            <Group justify="space-between">
              <Text size="sm" fw={500}>相关例题</Text>
              <Button variant="light" size="xs" onClick={addExample} leftSection={<IconPlus size={14} />}>
                添加例题
              </Button>
            </Group>

            {addForm.examples.map((example, index) => (
              <Card key={index} withBorder p="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>例题 {index + 1}</Text>
                    <ActionIcon 
                      variant="light" 
                      color="red" 
                      size="sm"
                      onClick={() => removeExample(index)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                  
                  <Textarea
                    label="题目"
                    placeholder="请输入例题题目"
                    value={example.question}
                    onChange={(e) => updateExample(index, 'question', e.target.value)}
                    minRows={2}
                  />
                  
                  <Textarea
                    label="解答"
                    placeholder="请输入解题步骤"
                    value={example.solution}
                    onChange={(e) => updateExample(index, 'solution', e.target.value)}
                    minRows={3}
                  />
                  
                  <Select
                    label="难度"
                    value={example.difficulty}
                    onChange={(value) => updateExample(index, 'difficulty', value || 'medium')}
                    data={[
                      { value: 'easy', label: '简单' },
                      { value: 'medium', label: '中等' },
                      { value: 'hard', label: '困难' },
                    ]}
                  />
                </Stack>
              </Card>
            ))}
            
            <Group justify="flex-end" gap="sm">
              <Button variant="light" onClick={closeAdd}>
                取消
              </Button>
              <Button onClick={handleSaveKnowledge}>
                保存
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
