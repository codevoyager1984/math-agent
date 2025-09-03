'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Stack,
  Title,
  Group,
  Button,
  TextInput,
  Select,
  Badge,
  ActionIcon,
  Modal,
  LoadingOverlay,
  Text,
  Image,
  Card,
} from '@mantine/core';
import { 
  IconPlus, 
  IconSearch, 
  IconEdit, 
  IconTrash, 
  IconEye,
  IconPhoto,
  IconCurrency,
  IconCalendar,
  IconToggleLeft,
  IconToggleRight
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import { toast } from 'sonner';
import { modals } from '@mantine/modals';
import ReactMarkdown from 'react-markdown';
import { 
  getProducts, 
  deleteProduct, 
  Product, 
  ProductListParams 
} from '@/api/product';
import PageHeader from '@/components/PageHeader/PageHeader';
import ProductFormModal from '@/components/product/ProductFormModal';

const RECORDS_PER_PAGE = 20;

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewModalOpened, setPreviewModalOpened] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formModalOpened, setFormModalOpened] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // 获取商品列表
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params: ProductListParams = {
        page,
        limit: RECORDS_PER_PAGE,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (statusFilter !== 'all') {
        params.is_active = statusFilter === 'active';
      }

      const response = await getProducts(params);
      setProducts(response.products);
      setTotalRecords(response.total);
    } catch (error) {
      console.error('获取商品列表失败:', error);
      toast.error('获取商品列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  // 初始加载和依赖更新时获取数据
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // 搜索处理
  const handleSearch = () => {
    setPage(1); // 重置到第一页
  };

  // 重置搜索
  const handleReset = () => {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  };

  // 删除商品
  const handleDelete = async (product: Product) => {
    modals.openConfirmModal({
      title: '确认删除',
      children: (
        <Text size="sm">
          确定要删除商品 <strong>{product.name}</strong> 吗？此操作不可撤销。
        </Text>
      ),
      labels: { confirm: '删除', cancel: '取消' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteProduct(product.id);
          toast.success('商品删除成功');
          fetchProducts();
        } catch (error) {
          console.error('删除商品失败:', error);
          toast.error('删除商品失败');
        }
      },
    });
  };

  // 预览商品详情
  const handlePreview = (product: Product) => {
    setSelectedProduct(product);
    setPreviewModalOpened(true);
  };

  // 打开新增商品弹窗
  const handleCreate = () => {
    setEditingProduct(null);
    setFormModalOpened(true);
  };

  // 打开编辑商品弹窗
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormModalOpened(true);
  };

  // 表单操作成功后的回调
  const handleFormSuccess = () => {
    fetchProducts(); // 刷新列表
  };

  // 关闭表单弹窗
  const handleFormClose = () => {
    setFormModalOpened(false);
    setEditingProduct(null);
  };

  // 格式化价格
  const formatPrice = (price: number) => {
    return `¥${price.toFixed(2)}`;
  };

  // 格式化租期
  const formatRentalPeriod = (months: number) => {
    return `${months}个月`;
  };

  return (
    <Container fluid>
      <Stack gap="lg">
        <PageHeader title="商品管理" />

        {/* 搜索和筛选 */}
        <Card withBorder p="md">
          <Stack gap="md">
            <Group align="flex-end" gap="md">
              <TextInput
                label="商品名称"
                placeholder="搜索商品名称"
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
                label="状态筛选"
                placeholder="选择状态"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value || 'all')}
                data={[
                  { value: 'all', label: '全部' },
                  { value: 'active', label: '启用' },
                  { value: 'inactive', label: '禁用' },
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
              共 {totalRecords} 个商品
            </Text>
          </Group>
          <Button 
            leftSection={<IconPlus size={16} />}
            onClick={handleCreate}
          >
            新增商品
          </Button>
        </Group>

        {/* 商品表格 */}
        <Card withBorder>
          <div style={{ position: 'relative' }}>
            <LoadingOverlay visible={loading} />
            <DataTable
              withTableBorder={false}
              records={products}
              totalRecords={totalRecords}
              recordsPerPage={RECORDS_PER_PAGE}
              page={page}
              onPageChange={setPage}
              columns={[
                {
                  accessor: 'id',
                  title: 'ID',
                  width: 80,
                  textAlign: 'center',
                },
                {
                  accessor: 'cover_image',
                  title: '封面',
                  width: 100,
                  textAlign: 'center',
                  render: (record) => (
                    record.cover_image ? (
                      <Image
                        src={record.cover_image}
                        alt={record.name}
                        w={60}
                        h={40}
                        radius="sm"
                        fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA2MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0yNSAyMEMyNSAxOC44OTU0IDI1Ljg5NTQgMTggMjcgMThIMzNDMzQuMTA0NiAxOCAzNSAxOC44OTU0IDM1IDIwVjI2QzM1IDI3LjEwNDYgMzQuMTA0NiAyOCAzMyAyOEgyN0MyNS44OTU0IDI4IDI1IDI3LjEwNDYgMjUgMjZWMjBaIiBmaWxsPSIjQzNDM0MzIi8+Cjwvc3ZnPgo="
                      />
                    ) : (
                      <div style={{ 
                        width: 60, 
                        height: 40, 
                        backgroundColor: '#f5f5f5', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        borderRadius: 4
                      }}>
                        <IconPhoto size={20} color="#c3c3c3" />
                      </div>
                    )
                  ),
                },
                {
                  accessor: 'name',
                  title: '商品名称',
                  width: 200,
                  render: (record) => (
                    <Text fw={500} lineClamp={2}>
                      {record.name}
                    </Text>
                  ),
                },
                {
                  accessor: 'rental_period',
                  title: '租期',
                  width: 100,
                  textAlign: 'center',
                  render: (record) => (
                    <Group gap="xs" justify="center">
                      <IconCalendar size={14} />
                      <Text size="sm">{formatRentalPeriod(record.rental_period)}</Text>
                    </Group>
                  ),
                },
                {
                  accessor: 'monthly_price',
                  title: '每月金额',
                  width: 120,
                  textAlign: 'right',
                  render: (record) => (
                    <Group gap="xs" justify="flex-end">
                      <IconCurrency size={14} />
                      <Text fw={500} c="green">
                        {formatPrice(record.monthly_price)}
                      </Text>
                    </Group>
                  ),
                },
                {
                  accessor: 'service_fee',
                  title: '服务费',
                  width: 120,
                  textAlign: 'right',
                  render: (record) => (
                    <Group gap="xs" justify="flex-end">
                      <IconCurrency size={14} />
                      <Text fw={500} c="blue">
                        {formatPrice(record.service_fee)}
                      </Text>
                    </Group>
                  ),
                },
                {
                  accessor: 'is_active',
                  title: '状态',
                  width: 100,
                  textAlign: 'center',
                  render: (record) => (
                    <Badge
                      color={record.is_active ? 'green' : 'gray'}
                      variant="light"
                      leftSection={
                        record.is_active ? (
                          <IconToggleRight size={12} />
                        ) : (
                          <IconToggleLeft size={12} />
                        )
                      }
                    >
                      {record.is_active ? '启用' : '禁用'}
                    </Badge>
                  ),
                },
                {
                  accessor: 'created_at',
                  title: '创建时间',
                  width: 160,
                  render: (record) => (
                    <Text size="sm" c="dimmed">
                      {record.created_at ? new Date(record.created_at).toLocaleString('zh-CN') : '-'}
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
                        onClick={() => handlePreview(record)}
                      >
                        <IconEye size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="orange"
                        size="sm"
                        onClick={() => handleEdit(record)}
                      >
                        <IconEdit size={14} />
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
              noRecordsText="暂无商品数据"
              loadingText="加载中..."
            />
          </div>
        </Card>

        {/* 商品预览弹窗 */}
        <Modal
          opened={previewModalOpened}
          onClose={() => setPreviewModalOpened(false)}
          title="商品详情"
          size="lg"
        >
          {selectedProduct && (
            <Stack gap="md">
              <Group align="flex-start" gap="md">
                {selectedProduct.cover_image ? (
                  <Image
                    src={selectedProduct.cover_image}
                    alt={selectedProduct.name}
                    w={200}
                    h={150}
                    radius="md"
                    fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik04MCA3NUM4MCA3My44OTU0IDgwLjg5NTQgNzMgODIgNzNIODhDODkuMTA0NiA3MyA5MCA3My44OTU0IDkwIDc1VjgxQzkwIDgyLjEwNDYgODkuMTA0NiA4MyA4OCA4M0g4MkM4MC44OTU0IDgzIDgwIDgyLjEwNDYgODAgODFWNzVaIiBmaWxsPSIjQzNDM0MzIi8+Cjwvc3ZnPgo="
                  />
                ) : (
                  <div style={{
                    width: 200,
                    height: 150,
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8
                  }}>
                    <IconPhoto size={40} color="#c3c3c3" />
                  </div>
                )}
                <Stack gap="sm" style={{ flex: 1 }}>
                  <Title order={3}>{selectedProduct.name}</Title>
                  <Group gap="md">
                    <Badge
                      color={selectedProduct.is_active ? 'green' : 'gray'}
                      variant="light"
                    >
                      {selectedProduct.is_active ? '启用' : '禁用'}
                    </Badge>
                  </Group>
                  <Group gap="md">
                    <Text size="sm">
                      <strong>租期：</strong>{formatRentalPeriod(selectedProduct.rental_period)}
                    </Text>
                    <Text size="sm" c="green" fw={500}>
                      <strong>每月金额：</strong>{formatPrice(selectedProduct.monthly_price)}
                    </Text>
                    <Text size="sm" c="blue" fw={500}>
                      <strong>服务费：</strong>{formatPrice(selectedProduct.service_fee)}
                    </Text>
                  </Group>
                </Stack>
              </Group>
              
              {selectedProduct.description && (
                <div>
                  <Text fw={500} mb="xs">商品介绍：</Text>
                  <Card withBorder p="sm" bg="gray.0">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <Text size="lg" fw={700} mb="sm">{children}</Text>,
                        h2: ({ children }) => <Text size="md" fw={600} mb="sm">{children}</Text>,
                        h3: ({ children }) => <Text size="sm" fw={500} mb="xs">{children}</Text>,
                        p: ({ children }) => <Text size="sm" mb="xs">{children}</Text>,
                        ul: ({ children }) => <ul style={{ marginBottom: '0.5rem', paddingLeft: '1rem' }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ marginBottom: '0.5rem', paddingLeft: '1rem' }}>{children}</ol>,
                        li: ({ children }) => <li style={{ marginBottom: '0.125rem' }}>{children}</li>,
                        strong: ({ children }) => <Text component="strong" fw={600}>{children}</Text>,
                        em: ({ children }) => <Text component="em" fs="italic">{children}</Text>,
                        code: ({ children }) => (
                          <Text 
                            component="code" 
                            bg="gray.2" 
                            px={4} 
                            py={1} 
                            style={{ borderRadius: '3px', fontSize: '0.8em' }}
                          >
                            {children}
                          </Text>
                        ),
                      }}
                    >
                      {selectedProduct.description}
                    </ReactMarkdown>
                  </Card>
                </div>
              )}
              
              <Group gap="md">
                <Text size="xs" c="dimmed">
                  创建时间：{selectedProduct.created_at ? new Date(selectedProduct.created_at).toLocaleString('zh-CN') : '-'}
                </Text>
                <Text size="xs" c="dimmed">
                  更新时间：{selectedProduct.updated_at ? new Date(selectedProduct.updated_at).toLocaleString('zh-CN') : '-'}
                </Text>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* 商品新增/编辑表单弹窗 */}
        <ProductFormModal
          opened={formModalOpened}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          product={editingProduct}
        />
      </Stack>
    </Container>
  );
}

export default ProductsPage;
