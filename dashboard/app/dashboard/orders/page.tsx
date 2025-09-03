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
  Chip,
  Flex,
  Tooltip,
} from '@mantine/core';
import { 
  IconEye, 
  IconSearch, 
  IconRefresh, 
  IconChevronDown, 
  IconChevronUp,
  IconUser,
  IconCalendar,
  IconCurrency,
  IconClock,
  IconAlertTriangle,
  IconShoppingCart,
  IconCash,
  IconTrendingUp,
  IconFileText,
  IconPackageExport,
  IconCheck,
  IconEdit,
  IconBell,
  IconClipboardCheck,
  IconX,
  IconPhoto
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader/PageHeader';
import { StatsGrid, StatsGridItem } from '@/components/common/StatsGrid';
import { formatTimestamp } from '@/utils';
import { 
  getOrders, 
  getOrderStatistics,
  returnAsset,
  updateInstallment,
  reviewOrder,
  Order, 
  OrderInstallment,
  OrderListParams,
  OrderListResponse,
  OrderStatistics,
  ReturnAssetRequest,
  InstallmentUpdateRequest,
  ReviewOrderRequest
} from '@/api/order';

// 状态映射
const statusMap = {
  pending: { label: '待付款', color: 'orange' },
  under_review: { label: '待审核', color: 'yellow' },
  inprogress: { label: '进行中', color: 'blue' },
  paid: { label: '已付款', color: 'green' },
  cancelled: { label: '已取消', color: 'gray' },
  completed: { label: '已完成', color: 'teal' },
  rejected: { label: '已拒绝', color: 'red' },
};

const installmentStatusMap = {
  pending: { label: '待付款', color: 'orange' },
  paid: { label: '已付款', color: 'green' },
  overdue: { label: '已逾期', color: 'red' },
  cancelled: { label: '已取消', color: 'gray' },
};

const RECORDS_PER_PAGE = 20;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [returnAssetOpened, { open: openReturnAsset, close: closeReturnAsset }] = useDisclosure(false);
  const [returnAssetOrder, setReturnAssetOrder] = useState<Order | null>(null);
  const [pendingAmount, setPendingAmount] = useState<number>(0);
  const [returnAssetLoading, setReturnAssetLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [statistics, setStatistics] = useState<OrderStatistics | null>(null);
  
  // 分期编辑相关状态
  const [editInstallmentOpened, { open: openEditInstallment, close: closeEditInstallment }] = useDisclosure(false);
  const [editingInstallment, setEditingInstallment] = useState<OrderInstallment | null>(null);
  const [editInstallmentLoading, setEditInstallmentLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    status: '',
    amount: 0,
    payment_method: ''
  });
  
  // 审核相关状态
  const [reviewOpened, { open: openReview, close: closeReview }] = useDisclosure(false);
  const [reviewingOrder, setReviewingOrder] = useState<Order | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewRemark, setReviewRemark] = useState('');
  
  // 图片预览相关状态
  const [imagePreviewOpened, { open: openImagePreview, close: closeImagePreview }] = useDisclosure(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  
  // 移动端检测
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 获取统计数据
  const fetchStatistics = useCallback(async () => {
    try {
      setStatsLoading(true);
      const stats = await getOrderStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('获取统计数据失败:', error);
      toast.error('获取统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // 获取订单列表
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params: OrderListParams = {
        page,
        limit: RECORDS_PER_PAGE,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (statusFilter !== 'all' && statusFilter !== 'overdue') {
        params.status = statusFilter;
      }

      const response = await getOrders(params);
      
      // 如果筛选逾期订单，需要在前端过滤
      if (statusFilter === 'overdue') {
        const now = new Date();
        const overdueOrders = response.orders.filter(order => 
          order.installments.some(installment => 
            installment.status === 'pending' && 
            new Date(installment.due_date) < now
          )
        );
        setOrders(overdueOrders);
        setTotalRecords(overdueOrders.length);
      } else {
        setOrders(response.orders);
        setTotalRecords(response.total);
      }
    } catch (error) {
      console.error('获取订单列表失败:', error);
      toast.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  // 初始加载和依赖更新时获取数据
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 初始加载统计数据
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

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

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    openDetail();
  };

  // 计算待支付金额
  const calculatePendingAmount = (order: Order) => {
    const pendingInstallments = order.installments.filter(
      installment => installment.status === 'pending'
    );
    return pendingInstallments.reduce((total, installment) => total + installment.amount, 0);
  };

  // 处理归还资产
  const handleReturnAsset = (order: Order) => {
    setReturnAssetOrder(order);
    const calculatedAmount = calculatePendingAmount(order);
    setPendingAmount(calculatedAmount);
    openReturnAsset();
  };

  // 确认归还资产
  const handleConfirmReturnAsset = async () => {
    if (!returnAssetOrder) return;

    try {
      setReturnAssetLoading(true);
      await returnAsset(returnAssetOrder.id, { pending_amount: pendingAmount });
      toast.success('归还资产处理成功');
      closeReturnAsset();
      setReturnAssetOrder(null);
      setPendingAmount(0);
      // 刷新数据
      fetchOrders();
      fetchStatistics();
    } catch (error) {
      console.error('归还资产失败:', error);
      toast.error('归还资产失败');
    } finally {
      setReturnAssetLoading(false);
    }
  };

  // 处理编辑分期
  const handleEditInstallment = (installment: OrderInstallment) => {
    setEditingInstallment(installment);
    setEditFormData({
      status: installment.status,
      amount: installment.amount,
      payment_method: installment.payment_method || ''
    });
    openEditInstallment();
  };

  // 确认更新分期
  const handleConfirmUpdateInstallment = async () => {
    if (!editingInstallment) return;

    try {
      setEditInstallmentLoading(true);
      
      const updateData: InstallmentUpdateRequest = {};
      
      // 只更新有变化的字段
      if (editFormData.status !== editingInstallment.status) {
        updateData.status = editFormData.status;
      }
      if (editFormData.amount !== editingInstallment.amount) {
        updateData.amount = editFormData.amount;
      }
      if (editFormData.payment_method !== (editingInstallment.payment_method || '')) {
        updateData.payment_method = editFormData.payment_method;
      }

      // 如果没有任何变化，直接关闭
      if (Object.keys(updateData).length === 0) {
        toast.info('没有任何变化');
        closeEditInstallment();
        return;
      }

      await updateInstallment(editingInstallment.id, updateData);
      toast.success('分期更新成功');
      closeEditInstallment();
      setEditingInstallment(null);
      
      // 刷新数据
      fetchOrders();
      fetchStatistics();
    } catch (error) {
      console.error('更新分期失败:', error);
      toast.error('更新分期失败');
    } finally {
      setEditInstallmentLoading(false);
    }
  };

  // 处理审核订单
  const handleReviewOrder = (order: Order) => {
    setReviewingOrder(order);
    setReviewRemark('');
    openReview();
  };

  // 确认审核订单
  const handleConfirmReview = async (action: 'approve' | 'reject') => {
    if (!reviewingOrder) return;

    try {
      setReviewLoading(true);
      
      const reviewData: ReviewOrderRequest = {
        action,
        remark: reviewRemark || undefined
      };

      await reviewOrder(reviewingOrder.id, reviewData);
      toast.success(action === 'approve' ? '审核通过' : '审核拒绝');
      closeReview();
      setReviewingOrder(null);
      setReviewRemark('');
      
      // 刷新数据
      fetchOrders();
      fetchStatistics();
    } catch (error) {
      console.error('审核订单失败:', error);
      toast.error('审核订单失败');
    } finally {
      setReviewLoading(false);
    }
  };

  // 处理图片预览
  const handleImagePreview = (imageUrl: string) => {
    setPreviewImageUrl(imageUrl);
    openImagePreview();
  };

  const toggleRowExpansion = (orderId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedRows(newExpanded);
  };

  const formatDate = (dateString?: string) => {
    return formatTimestamp.dateTime(dateString);
  };

  const formatCurrency = (amount: number) => {
    return `¥${amount.toFixed(2)}`;
  };

  // 获取用户显示名称（优先显示真实姓名，没有时显示昵称）
  const getUserDisplayName = (order: Order) => {
    return order.user_real_name || order.user_nickname || `用户${order.user_id}`;
  };

  // 检查订单是否有逾期分期
  const hasOverdueInstallments = (order: Order) => {
    const now = new Date();
    return order.installments.some(installment => 
      installment.status === 'pending' && 
      new Date(installment.due_date) < now
    );
  };

  // 生成统计数据显示项
  const getStatsData = (): StatsGridItem[] => {
    if (!statistics) return [];

    return [
      {
        title: '总订单数',
        value: statistics.total_orders.toString(),
        extra_elements: [<IconShoppingCart key="icon" size={20} />],
      },
      {
        title: '进行中订单',
        value: statistics.status_counts.inprogress.toString(),
        extra_elements: [<IconTrendingUp key="icon" size={20} color="blue" />],
      },
      {
        title: '待审核订单',
        value: statistics.status_counts.under_review.toString(),
        extra_elements: [
          <Group key="icon-group" gap={4}>
            <IconBell size={20} color="orange" />
            {statistics.status_counts.under_review > 0 && (
              <IconAlertTriangle size={16} color="red" />
            )}
          </Group>
        ],
      },
      {
        title: '逾期订单',
        value: statistics.overdue_orders.toString(),
        extra_elements: [<IconAlertTriangle key="icon" size={20} color="red" />],
      },
      {
        title: '已完成',
        value: statistics.status_counts.completed.toString(),
        extra_elements: [<IconCheck key="icon" size={20} color="teal" />],
      },
      {
        title: '本月新增',
        value: statistics.month_orders.toString(),
        extra_elements: [<IconCalendar key="icon" size={20} color="teal" />],
      },
    ];
  };

  // 快捷筛选状态
  const quickFilters = [
    { value: 'all', label: '全部', color: 'gray' },
    { value: 'inprogress', label: '进行中', color: 'blue' },
    { value: 'under_review', label: '待审核', color: 'yellow' },
    { value: 'pending', label: '待付款', color: 'orange' },
    { value: 'paid', label: '已付款', color: 'green' },
    { value: 'overdue', label: '逾期', color: 'red' },
    { value: 'completed', label: '已完成', color: 'teal' },
    { value: 'rejected', label: '已拒绝', color: 'red' },
  ];

  // 移动端订单卡片组件
  const MobileOrderCard = ({ order }: { order: Order }) => {
    const isOverdue = hasOverdueInstallments(order);
    const isUnfinished = order.status !== 'completed' && order.status !== 'cancelled';
    
    return (
      <Card 
        withBorder 
        mb="md" 
        p="md"
        style={isOverdue ? { borderColor: '#ff6b6b', backgroundColor: 'rgba(255, 245, 245, 0.6)' } : undefined}
      >
        <Stack gap="sm">
          {/* 第一行：订单号和状态 */}
          <Group justify="space-between" align="flex-start">
            <Box style={{ flex: 1 }}>
              <Text size="xs" c="dimmed">订单号</Text>
              <Text size="sm" fw={500} lineClamp={1}>{order.order_no}</Text>
            </Box>
            <Stack gap={4} align="flex-end">
              <Badge
                color={statusMap[order.status as keyof typeof statusMap]?.color || 'gray'}
                variant="filled"
                size="sm"
              >
                {statusMap[order.status as keyof typeof statusMap]?.label || order.status}
              </Badge>
              {isOverdue && (
                <Badge
                  color="red"
                  variant="light"
                  size="xs"
                  leftSection={<IconAlertTriangle size={10} />}
                >
                  逾期
                </Badge>
              )}
            </Stack>
          </Group>

          {/* 第二行：商品名称 */}
          <Box>
            <Text size="xs" c="dimmed">商品名称</Text>
            <Text size="sm" lineClamp={2}>{order.product_name}</Text>
          </Box>

          {/* 第三行：用户信息和创建时间 */}
          <Group justify="space-between">
            <Box style={{ flex: 1 }}>
              <Text size="xs" c="dimmed">用户信息</Text>
              <Group gap="xs">
                <IconUser size={12} />
                <Text size="sm">{getUserDisplayName(order)}</Text>
              </Group>
              {order.user_phone && (
                <Text size="xs" c="dimmed">{order.user_phone}</Text>
              )}
            </Box>
            <Box>
              <Text size="xs" c="dimmed">创建时间</Text>
              <Text size="sm">{formatDate(order.created_at)}</Text>
            </Box>
          </Group>

          {/* 第四行：租期、月租金、总金额 */}
          <Grid>
            <Grid.Col span={4}>
              <Text size="xs" c="dimmed">租期</Text>
              <Group gap="xs">
                <IconCalendar size={12} />
                <Text size="sm">{order.rental_period}个月</Text>
              </Group>
            </Grid.Col>
            <Grid.Col span={4}>
              <Text size="xs" c="dimmed">月租金</Text>
              <Group gap="xs">
                <IconCurrency size={12} />
                <Text size="sm" c="blue">{formatCurrency(order.monthly_price)}</Text>
              </Group>
            </Grid.Col>
            <Grid.Col span={4}>
              <Text size="xs" c="dimmed">总金额</Text>
              <Text size="sm" fw={500} c="green">{formatCurrency(order.total_amount)}</Text>
            </Grid.Col>
          </Grid>

          {/* 第五行：服务费和合同状态 */}
          <Group justify="space-between">
            <Box>
              <Text size="xs" c="dimmed">服务费</Text>
              <Stack gap={2}>
                <Text size="sm" c="blue">
                  {order.service_fee_amount ? formatCurrency(order.service_fee_amount) : '-'}
                </Text>
                <Badge
                  size="xs"
                  color={order.service_fee_paid ? 'green' : 'orange'}
                  variant="light"
                >
                  {order.service_fee_paid ? '已支付' : '未支付'}
                </Badge>
              </Stack>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">合同状态</Text>
              <Badge
                size="sm"
                color={
                  !order.sign_flow_id && !order.sign_status ? 'gray' :
                  order.sign_status === 'SUCCESS' ? 'green' : 'orange'
                }
                variant="light"
                leftSection={<IconFileText size={12} />}
              >
                {!order.sign_flow_id && !order.sign_status ? '未签署' :
                 order.sign_status === 'SUCCESS' ? '已签署' : '待签署'}
              </Badge>
            </Box>
          </Group>

          {/* 操作按钮 */}
          <Divider />
          {order.status === 'under_review' ? (
            // 审核中订单只显示审核按钮
            <Group justify="center">
              <Button
                variant="light"
                color="yellow"
                size="xs"
                leftSection={<IconClipboardCheck size={14} />}
                onClick={() => handleReviewOrder(order)}
              >
                审核
              </Button>
            </Group>
          ) : (
            // 非审核中订单显示完整操作按钮
            <Group justify="space-between">
              <Group gap="xs">
                <Button
                  variant="light"
                  color="blue"
                  size="xs"
                  leftSection={<IconEye size={14} />}
                  onClick={() => handleViewDetail(order)}
                >
                  查看详情
                </Button>
                {isUnfinished && (
                  <Button
                    variant="light"
                    color="green"
                    size="xs"
                    leftSection={<IconPackageExport size={14} />}
                    onClick={() => handleReturnAsset(order)}
                  >
                    归还资产
                  </Button>
                )}
              </Group>
              <Button
                variant="light"
                color="orange"
                size="xs"
                leftSection={expandedRows.has(order.id) ? 
                  <IconChevronUp size={14} /> : 
                  <IconChevronDown size={14} />
                }
                onClick={() => toggleRowExpansion(order.id)}
              >
                {expandedRows.has(order.id) ? "收起分期" : "展开分期"}
              </Button>
            </Group>
          )}

          {/* 展开的分期详情 */}
          {expandedRows.has(order.id) && (
            <Box>
              <Divider mb="sm" />
              <Text size="sm" fw={500} mb="sm">分期付款详情</Text>
              <Stack gap="xs">
                {order.installments.map((installment, index) => (
                  <Card key={installment.id} withBorder p="sm" bg="gray.0">
                    <Grid>
                      <Grid.Col span={6}>
                        <Text size="xs" c="dimmed">第{installment.installment_no}期</Text>
                        <Text size="sm" fw={500}>{formatCurrency(installment.amount)}</Text>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="xs" c="dimmed">状态</Text>
                        <Group gap="xs">
                          <Badge 
                            size="sm"
                            color={installmentStatusMap[installment.status as keyof typeof installmentStatusMap]?.color || 'gray'}
                          >
                            {installmentStatusMap[installment.status as keyof typeof installmentStatusMap]?.label || installment.status}
                          </Badge>
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            onClick={() => handleEditInstallment(installment)}
                          >
                            <IconEdit size={12} />
                          </ActionIcon>
                        </Group>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="xs" c="dimmed">到期时间</Text>
                        <Text size="sm">{formatDate(installment.due_date)}</Text>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Text size="xs" c="dimmed">付款时间</Text>
                        <Text size="sm">{formatDate(installment.paid_date)}</Text>
                      </Grid.Col>
                      {installment.payment_method && (
                        <Grid.Col span={12}>
                          <Text size="xs" c="dimmed">支付方式</Text>
                          <Text size="sm">{installment.payment_method}</Text>
                        </Grid.Col>
                      )}
                    </Grid>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Card>
    );
  };

  return (
    <Container fluid>
      <Stack gap="xl">
        <PageHeader title="订单管理" />

        {/* 统计数据 */}
        <StatsGrid 
          data={getStatsData()} 
          loading={statsLoading}
          cols={{ base: 2, sm: 3, md: isMobile ? 3 : 6 }}
          spacing={{ base: 'sm', sm: 'md', md: 'lg' }}
          paperProps={{ 
            shadow: 'sm',
            style: { 
              transition: 'all 0.2s ease',
              cursor: 'default'
            }
          }}
        />

        {/* 搜索和筛选 */}
        <Card withBorder p="md">
          <Stack gap="md">
            <Stack gap="md">
              <TextInput
                label="搜索"
                placeholder="搜索订单号或商品名称"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftSection={<IconSearch size={16} />}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
              <Group gap="sm" justify={isMobile ? "stretch" : "flex-start"}>
                <Button 
                  onClick={handleSearch} 
                  leftSection={<IconSearch size={16} />}
                  style={isMobile ? { flex: 1 } : undefined}
                >
                  搜索
                </Button>
                <Button 
                  variant="light" 
                  onClick={handleReset}
                  style={isMobile ? { flex: 1 } : undefined}
                >
                  重置
                </Button>
              </Group>
            </Stack>
            
            {/* 快捷筛选按钮 */}
            <Box>
              <Text size="sm" fw={500} mb="xs">快捷筛选</Text>
              <Flex gap="xs" wrap="wrap">
                {quickFilters.map((filter) => {
                  const count = statistics && filter.value !== 'all' ? (
                    filter.value === 'overdue' ? statistics.overdue_orders : 
                    filter.value === 'pending' ? statistics.pending_orders :
                    filter.value === 'under_review' ? statistics.status_counts.under_review :
                    filter.value === 'inprogress' ? statistics.status_counts.inprogress :
                    statistics.status_counts[filter.value as keyof typeof statistics.status_counts] || 0
                  ) : 0;
                  
                  const showNotification = filter.value === 'under_review' && count > 0;
                  
                  return (
                    <Chip
                      key={filter.value}
                      checked={statusFilter === filter.value}
                      onChange={() => {
                        setStatusFilter(filter.value);
                        setPage(1);
                      }}
                      color={filter.color}
                      size="sm"
                    >
                      <Group gap={4} align="center">
                        {showNotification && (
                          <IconBell size={12} style={{ color: '#fa5252' }} />
                        )}
                        {filter.label}
                        {statistics && filter.value !== 'all' && (
                          <Badge 
                            size="xs" 
                            ml="xs" 
                            variant="light"
                            color={filter.color}
                          >
                            {count}
                          </Badge>
                        )}
                      </Group>
                    </Chip>
                  );
                })}
              </Flex>
            </Box>
          </Stack>
        </Card>

        {/* 操作栏 */}
        <Group justify="space-between">
          <Group gap="sm">
            <Text size="sm" c="dimmed">
              共 {totalRecords} 个订单
            </Text>
            {statusFilter !== 'all' && (
              <Badge variant="light" color="blue">
                {quickFilters.find(f => f.value === statusFilter)?.label}
              </Badge>
            )}
          </Group>
          <Group gap="sm">
            <Button 
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => {
                fetchOrders();
                fetchStatistics();
              }}
              loading={loading || statsLoading}
            >
              刷新
            </Button>
          </Group>
        </Group>

        {/* 订单表格/卡片 */}
        {isMobile ? (
          // 移动端卡片视图
          <Box>
            <LoadingOverlay visible={loading} />
            {orders.length === 0 ? (
              <Card withBorder>
                <Box p="xl" style={{ textAlign: 'center' }}>
                  <Text c="dimmed">暂无订单数据</Text>
                </Box>
              </Card>
            ) : (
              <Stack gap="md">
                {orders.map((order) => (
                  <MobileOrderCard key={order.id} order={order} />
                ))}
                
                {/* 移动端分页 */}
                {totalRecords > RECORDS_PER_PAGE && (
                  <Card withBorder p="md">
                    <Group justify="center">
                      <Button
                        variant="light"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        上一页
                      </Button>
                      <Text size="sm">
                        第 {page} 页，共 {Math.ceil(totalRecords / RECORDS_PER_PAGE)} 页
                      </Text>
                      <Button
                        variant="light"
                        disabled={page >= Math.ceil(totalRecords / RECORDS_PER_PAGE)}
                        onClick={() => setPage(page + 1)}
                      >
                        下一页
                      </Button>
                    </Group>
                  </Card>
                )}
              </Stack>
            )}
          </Box>
        ) : (
          // 桌面端表格视图
          <Card withBorder>
            <div style={{ position: 'relative' }}>
              <LoadingOverlay visible={loading} />
              <DataTable
              withTableBorder={false}
              records={orders}
              totalRecords={totalRecords}
              recordsPerPage={RECORDS_PER_PAGE}
              page={page}
              onPageChange={setPage}
              rowStyle={(record) => 
                hasOverdueInstallments(record) 
                  ? { backgroundColor: 'rgba(255, 245, 245, 0.6)' } 
                  : undefined
              }
              columns={[
                {
                  accessor: 'order_no',
                  title: '订单号',
                  width: 150,
                  render: (record) => (
                    <Text size="sm" fw={500} lineClamp={1}>
                      {record.order_no}
                    </Text>
                  ),
                },
                {
                  accessor: 'product_name',
                  title: '商品名称',
                  width: 200,
                  render: (record) => (
                    <Text size="sm" lineClamp={2}>
                      {record.product_name}
                    </Text>
                  ),
                },
                {
                  accessor: 'user_info',
                  title: '用户信息',
                  width: 150,
                  render: (record) => (
                    <Stack gap={2}>
                      <Group gap="xs">
                        <IconUser size={14} />
                        <Text size="sm">{getUserDisplayName(record)}</Text>
                      </Group>
                      {record.user_phone && (
                        <Text size="xs" c="dimmed">{record.user_phone}</Text>
                      )}
                    </Stack>
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
                      <Text size="sm">{record.rental_period}个月</Text>
                    </Group>
                  ),
                },
                {
                  accessor: 'monthly_price',
                  title: '月租金',
                  width: 120,
                  textAlign: 'right',
                  render: (record) => (
                    <Group gap="xs" justify="flex-end">
                      <IconCurrency size={14} />
                      <Text size="sm" c="blue">
                        {formatCurrency(record.monthly_price)}
                      </Text>
                    </Group>
                  ),
                },
                {
                  accessor: 'total_amount',
                  title: '总金额',
                  width: 120,
                  textAlign: 'right',
                  render: (record) => (
                    <Text size="sm" fw={500} c="green">
                      {formatCurrency(record.total_amount)}
                    </Text>
                  ),
                },
                {
                  accessor: 'service_fee',
                  title: '服务费',
                  width: 120,
                  textAlign: 'center',
                  render: (record) => (
                    <Stack gap={2} align="center">
                      <Text size="sm" c="blue">
                        {record.service_fee_amount ? formatCurrency(record.service_fee_amount) : '-'}
                      </Text>
                      <Badge
                        size="xs"
                        color={record.service_fee_paid ? 'green' : 'orange'}
                        variant="light"
                      >
                        {record.service_fee_paid ? '已支付' : '未支付'}
                      </Badge>
                    </Stack>
                  ),
                },
                {
                  accessor: 'contract_status',
                  title: '合同状态',
                  width: 100,
                  textAlign: 'center',
                  render: (record) => {
                    const hasContract = record.sign_flow_id || record.sign_status;
                    const isContractSigned = record.sign_status === 'SUCCESS';
                    
                    return (
                      <Badge
                        size="sm"
                        color={!hasContract ? 'gray' : isContractSigned ? 'green' : 'orange'}
                        variant="light"
                        leftSection={<IconFileText size={12} />}
                      >
                        {!hasContract ? '未签署' : isContractSigned ? '已签署' : '待签署'}
                      </Badge>
                    );
                  },
                },
                {
                  accessor: 'status',
                  title: '状态',
                  width: 120,
                  textAlign: 'center',
                  render: (record) => {
                    const isOverdue = hasOverdueInstallments(record);
                    return (
                      <Stack gap={4} align="center">
                        <Badge
                          color={statusMap[record.status as keyof typeof statusMap]?.color || 'gray'}
                          variant="filled"
                        >
                          {statusMap[record.status as keyof typeof statusMap]?.label || record.status}
                        </Badge>
                        {isOverdue && (
                          <Badge
                            color="red"
                            variant="light"
                            size="xs"
                            leftSection={<IconAlertTriangle size={10} />}
                          >
                            逾期
                          </Badge>
                        )}
                      </Stack>
                    );
                  },
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
                  width: 160,
                  textAlign: 'center',
                  render: (record) => {
                    const isUnfinished = record.status !== 'completed' && record.status !== 'cancelled';
                    
                    if (record.status === 'under_review' || record.status === 'rejected') {
                      // 审核中订单只显示审核按钮
                      return (
                        <Group gap="xs">
                          <Tooltip label="审核订单">
                            <ActionIcon
                              variant="light"
                              color="yellow"
                              size="sm"
                              onClick={() => handleReviewOrder(record)}
                            >
                              <IconClipboardCheck size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      );
                    }
                    
                    // 非审核中订单显示完整操作按钮
                    return (
                      <Group gap="xs">
                        <Tooltip label="查看详情">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            onClick={() => handleViewDetail(record)}
                          >
                            <IconEye size={14} />
                          </ActionIcon>
                        </Tooltip>
                        {isUnfinished && (
                          <Tooltip label="归还资产">
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="sm"
                              onClick={() => handleReturnAsset(record)}
                            >
                              <IconPackageExport size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label={expandedRows.has(record.id) ? "收起分期详情" : "展开分期详情"}>
                          <ActionIcon
                            variant="light"
                            color="orange"
                            size="sm"
                            onClick={() => toggleRowExpansion(record.id)}
                          >
                            {expandedRows.has(record.id) ? 
                              <IconChevronUp size={14} /> : 
                              <IconChevronDown size={14} />
                            }
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    );
                  },
                },
              ]}
              striped
              highlightOnHover
              minHeight={400}
              noRecordsText="暂无订单数据"
              loadingText="加载中..."
              rowExpansion={{
                trigger: 'never',
                allowMultiple: true,
                expanded: {
                  recordIds: Array.from(expandedRows),
                  onRecordIdsChange: (recordIds: unknown[]) => {
                    setExpandedRows(new Set(recordIds as number[]));
                  },
                },
                content: ({ record }) => (
                  expandedRows.has(record.id) ? (
                    <Box p="md" bg="gray.0">
                      <Text size="sm" fw={500} mb="sm">分期付款详情</Text>
                      <DataTable
                        withTableBorder={false}
                        records={record.installments}
                        columns={[
                          {
                            accessor: 'installment_no',
                            title: '期数',
                            width: 80,
                            render: (installment) => `第${installment.installment_no}期`,
                          },
                          {
                            accessor: 'amount',
                            title: '金额',
                            width: 100,
                            render: (installment) => formatCurrency(installment.amount),
                          },
                          {
                            accessor: 'due_date',
                            title: '到期时间',
                            width: 150,
                            render: (installment) => formatDate(installment.due_date),
                          },
                          {
                            accessor: 'paid_date',
                            title: '付款时间',
                            width: 150,
                            render: (installment) => formatDate(installment.paid_date),
                          },
                          {
                            accessor: 'status',
                            title: '状态',
                            width: 100,
                            render: (installment) => (
                              <Badge 
                                size="sm"
                                color={installmentStatusMap[installment.status as keyof typeof installmentStatusMap]?.color || 'gray'}
                              >
                                {installmentStatusMap[installment.status as keyof typeof installmentStatusMap]?.label || installment.status}
                              </Badge>
                            ),
                          },
                          {
                            accessor: 'payment_method',
                            title: '支付方式',
                            width: 100,
                            render: (installment) => installment.payment_method || '-',
                          },
                          {
                            accessor: 'out_trade_no',
                            title: '商户订单号',
                            width: 150,
                            render: (installment) => (
                              <Text size="xs" c={installment.out_trade_no ? 'blue' : 'dimmed'} ff="monospace">
                                {installment.out_trade_no || '-'}
                              </Text>
                            ),
                          },
                          {
                            accessor: 'trade_no',
                            title: '支付宝交易号',
                            width: 200,
                            render: (installment) => (
                              <Text size="xs" c={installment.trade_no ? 'green' : 'dimmed'} ff="monospace">
                                {installment.trade_no || '-'}
                              </Text>
                            ),
                          },
                          {
                            accessor: 'actions',
                            title: '操作',
                            width: 80,
                            textAlign: 'center',
                            render: (installment) => (
                              <Tooltip label="编辑分期">
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  size="sm"
                                  onClick={() => handleEditInstallment(installment)}
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              </Tooltip>
                            ),
                          },
                        ]}
                        minHeight={0}
                      />
                    </Box>
                  ) : null
                ),
              }}
            />
            </div>
          </Card>
        )}

        {/* 订单详情弹窗 */}
        <Modal
          opened={detailOpened}
          onClose={closeDetail}
          title="订单详情"
          size="xl"
        >
        {selectedOrder && (
          <Stack gap="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">订单号</Text>
                <Text fw={500}>{selectedOrder.order_no}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">状态</Text>
                <Badge 
                  color={statusMap[selectedOrder.status as keyof typeof statusMap]?.color || 'gray'}
                  variant="filled"
                >
                  {statusMap[selectedOrder.status as keyof typeof statusMap]?.label || selectedOrder.status}
                </Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">商品名称</Text>
                <Text>{selectedOrder.product_name}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">用户信息</Text>
                <Text>{getUserDisplayName(selectedOrder)}</Text>
                {selectedOrder.user_phone && (
                  <Text size="xs" c="dimmed">{selectedOrder.user_phone}</Text>
                )}
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">租期</Text>
                <Text>{selectedOrder.rental_period}个月</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">月租金</Text>
                <Text>{formatCurrency(selectedOrder.monthly_price)}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">总金额</Text>
                <Text fw={500}>{formatCurrency(selectedOrder.total_amount)}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">创建时间</Text>
                <Text>{formatDate(selectedOrder.created_at)}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">服务费金额</Text>
                <Text c="blue">
                  {selectedOrder.service_fee_amount ? formatCurrency(selectedOrder.service_fee_amount) : '-'}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">服务费支付状态</Text>
                <Badge
                  color={selectedOrder.service_fee_paid ? 'green' : 'orange'}
                  variant="light"
                >
                  {selectedOrder.service_fee_paid ? '已支付' : '未支付'}
                </Badge>
                {selectedOrder.service_fee_paid && selectedOrder.service_fee_paid_date && (
                  <Text size="xs" c="dimmed" mt={2}>
                    支付时间: {formatDate(selectedOrder.service_fee_paid_date)}
                  </Text>
                )}
              </Grid.Col>
              <Grid.Col span={12}>
                <Text size="sm" c="dimmed">合同签署状态</Text>
                <Group gap="sm" align="center">
                  <Badge
                    color={
                      !selectedOrder.sign_flow_id && !selectedOrder.sign_status ? 'gray' :
                      selectedOrder.sign_status === 'signed' || selectedOrder.sign_status === 'completed' ? 'green' : 'orange'
                    }
                    variant="light"
                    leftSection={<IconFileText size={12} />}
                  >
                    {!selectedOrder.sign_flow_id && !selectedOrder.sign_status ? '未签署' :
                     selectedOrder.sign_status === 'signed' || selectedOrder.sign_status === 'completed' ? '已签署' : '待签署'}
                  </Badge>
                  {selectedOrder.sign_flow_id && (
                    <Text size="xs" c="dimmed">
                      签署流程ID: {selectedOrder.sign_flow_id}
                    </Text>
                  )}
                </Group>
              </Grid.Col>
            </Grid>

            {selectedOrder.remark && (
              <>
                <Divider />
                <Box>
                  <Text size="sm" c="dimmed" mb="xs">备注</Text>
                  <Text>{selectedOrder.remark}</Text>
                </Box>
              </>
            )}

            <Divider />
            
            {/* 审核材料展示 */}
            <Box>
              <Text size="sm" fw={500} mb="sm">审核材料</Text>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Card withBorder p="sm">
                    <Stack gap="xs" align="center">
                      <IconPhoto size={24} color="gray" />
                      <Text size="xs" c="dimmed" ta="center">人车合一照片</Text>
                      {selectedOrder.rencheheyi_image ? (
                        <img 
                          src={selectedOrder.rencheheyi_image} 
                          alt="人车合一照片"
                          style={{ 
                            width: '100%', 
                            height: '120px', 
                            objectFit: 'cover', 
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleImagePreview(selectedOrder.rencheheyi_image!)}
                        />
                      ) : (
                        <Box 
                          style={{ 
                            width: '100%', 
                            height: '120px', 
                            backgroundColor: '#f1f3f4', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            borderRadius: '4px'
                          }}
                        >
                          <Text size="xs" c="dimmed">未上传</Text>
                        </Box>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Card withBorder p="sm">
                    <Stack gap="xs" align="center">
                      <IconPhoto size={24} color="gray" />
                      <Text size="xs" c="dimmed" ta="center">车架号照片</Text>
                      {selectedOrder.chejiahao_image ? (
                        <img 
                          src={selectedOrder.chejiahao_image} 
                          alt="车架号照片"
                          style={{ 
                            width: '100%', 
                            height: '120px', 
                            objectFit: 'cover', 
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleImagePreview(selectedOrder.chejiahao_image!)}
                        />
                      ) : (
                        <Box 
                          style={{ 
                            width: '100%', 
                            height: '120px', 
                            backgroundColor: '#f1f3f4', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            borderRadius: '4px'
                          }}
                        >
                          <Text size="xs" c="dimmed">未上传</Text>
                        </Box>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Card withBorder p="sm">
                    <Stack gap="xs" align="center">
                      <IconPhoto size={24} color="gray" />
                      <Text size="xs" c="dimmed" ta="center">芝麻信用照片</Text>
                      {selectedOrder.zhimaxinyong_image ? (
                        <img 
                          src={selectedOrder.zhimaxinyong_image} 
                          alt="芝麻信用照片"
                          style={{ 
                            width: '100%', 
                            height: '120px', 
                            objectFit: 'cover', 
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleImagePreview(selectedOrder.zhimaxinyong_image!)}
                        />
                      ) : (
                        <Box 
                          style={{ 
                            width: '100%', 
                            height: '120px', 
                            backgroundColor: '#f1f3f4', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            borderRadius: '4px'
                          }}
                        >
                          <Text size="xs" c="dimmed">未上传</Text>
                        </Box>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>
            </Box>

            <Divider />
            
            <Box>
              <Text size="sm" fw={500} mb="sm">分期付款详情</Text>
              <DataTable
                withTableBorder={false}
                records={selectedOrder.installments}
                columns={[
                  {
                    accessor: 'installment_no',
                    title: '期数',
                    width: 80,
                    render: (installment) => `第${installment.installment_no}期`,
                  },
                  {
                    accessor: 'amount',
                    title: '金额',
                    width: 100,
                    render: (installment) => formatCurrency(installment.amount),
                  },
                  {
                    accessor: 'due_date',
                    title: '到期时间',
                    width: 150,
                    render: (installment) => formatDate(installment.due_date),
                  },
                  {
                    accessor: 'paid_date',
                    title: '付款时间',
                    width: 150,
                    render: (installment) => formatDate(installment.paid_date),
                  },
                  {
                    accessor: 'status',
                    title: '状态',
                    width: 100,
                    render: (installment) => (
                      <Badge 
                        size="sm"
                        color={installmentStatusMap[installment.status as keyof typeof installmentStatusMap]?.color || 'gray'}
                      >
                        {installmentStatusMap[installment.status as keyof typeof installmentStatusMap]?.label || installment.status}
                      </Badge>
                    ),
                  },
                  {
                    accessor: 'payment_method',
                    title: '支付方式',
                    width: 100,
                    render: (installment) => installment.payment_method || '-',
                  },
                  {
                    accessor: 'out_trade_no',
                    title: '商户订单号',
                    width: 150,
                    render: (installment) => (
                      <Text size="xs" c={installment.out_trade_no ? 'blue' : 'dimmed'} ff="monospace">
                        {installment.out_trade_no || '-'}
                      </Text>
                    ),
                  },
                  {
                    accessor: 'trade_no',
                    title: '支付宝交易号',
                    width: 200,
                    render: (installment) => (
                      <Text size="xs" c={installment.trade_no ? 'green' : 'dimmed'} ff="monospace">
                        {installment.trade_no || '-'}
                      </Text>
                    ),
                  },
                  {
                    accessor: 'actions',
                    title: '操作',
                    width: 80,
                    textAlign: 'center',
                    render: (installment) => (
                      <Tooltip label="编辑分期">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size="sm"
                          onClick={() => handleEditInstallment(installment)}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Tooltip>
                    ),
                  },
                ]}
                minHeight={0}
              />
            </Box>
          </Stack>
        )}
        </Modal>

        {/* 归还资产弹窗 */}
        <Modal
          opened={returnAssetOpened}
          onClose={closeReturnAsset}
          title="归还资产"
          size="md"
        >
          {returnAssetOrder && (
            <Stack gap="md">
              <Box>
                <Text size="sm" c="dimmed" mb="xs">订单信息</Text>
                <Card withBorder p="sm" bg="gray.0">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">订单号:</Text>
                      <Text size="sm" fw={500}>{returnAssetOrder.order_no}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">商品名称:</Text>
                      <Text size="sm">{returnAssetOrder.product_name}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">用户:</Text>
                      <Text size="sm">{getUserDisplayName(returnAssetOrder)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">当前状态:</Text>
                      <Badge
                        color={statusMap[returnAssetOrder.status as keyof typeof statusMap]?.color || 'gray'}
                        variant="filled"
                      >
                        {statusMap[returnAssetOrder.status as keyof typeof statusMap]?.label || returnAssetOrder.status}
                      </Badge>
                    </Group>
                  </Stack>
                </Card>
              </Box>

              <Box>
                <Text size="sm" c="dimmed" mb="xs">待支付金额</Text>
                <TextInput
                  label="金额 (元)"
                  placeholder="请输入待支付金额"
                  value={pendingAmount}
                  onChange={(e) => setPendingAmount(parseFloat(e.target.value) || 0)}
                  type="number"
                  step="0.01"
                  min="0"
                  leftSection={<IconCurrency size={16} />}
                />
                <Text size="xs" c="dimmed" mt="xs">
                  系统自动计算的待支付金额为: ¥{calculatePendingAmount(returnAssetOrder).toFixed(2)}
                </Text>
              </Box>

              <Box>
                <Text size="sm" c="dimmed" mb="xs">操作说明</Text>
                <Text size="sm" c="orange">
                  确认归还资产后，订单状态将变更为"已完成"，所有未付款的分期将被取消，待支付金额将记录到订单备注中。
                </Text>
              </Box>

              <Group justify="flex-end" gap="sm">
                <Button 
                  variant="light" 
                  onClick={closeReturnAsset}
                  disabled={returnAssetLoading}
                >
                  取消
                </Button>
                <Button 
                  color="green"
                  onClick={handleConfirmReturnAsset}
                  loading={returnAssetLoading}
                  leftSection={<IconPackageExport size={16} />}
                >
                  确认归还
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* 编辑分期弹窗 */}
        <Modal
          opened={editInstallmentOpened}
          onClose={closeEditInstallment}
          title="编辑分期详情"
          size="md"
        >
          {editingInstallment && (
            <Stack gap="md">
              <Box>
                <Text size="sm" c="dimmed" mb="xs">分期信息</Text>
                <Card withBorder p="sm" bg="gray.0">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">期数:</Text>
                      <Text size="sm" fw={500}>第{editingInstallment.installment_no}期</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">到期时间:</Text>
                      <Text size="sm">{formatDate(editingInstallment.due_date)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">当前状态:</Text>
                      <Badge
                        color={installmentStatusMap[editingInstallment.status as keyof typeof installmentStatusMap]?.color || 'gray'}
                        variant="light"
                      >
                        {installmentStatusMap[editingInstallment.status as keyof typeof installmentStatusMap]?.label || editingInstallment.status}
                      </Badge>
                    </Group>
                  </Stack>
                </Card>
              </Box>

              <Select
                label="状态"
                placeholder="选择分期状态"
                value={editFormData.status}
                onChange={(value) => setEditFormData(prev => ({ ...prev, status: value || '' }))}
                data={[
                  { value: 'pending', label: '待付款' },
                  { value: 'paid', label: '已付款' },
                  { value: 'overdue', label: '已逾期' },
                  { value: 'cancelled', label: '已取消' },
                ]}
                required
              />

              <TextInput
                label="金额 (元)"
                placeholder="请输入分期金额"
                value={editFormData.amount}
                onChange={(e) => setEditFormData(prev => ({ 
                  ...prev, 
                  amount: parseFloat(e.target.value) || 0 
                }))}
                type="number"
                step="0.01"
                min="0"
                leftSection={<IconCurrency size={16} />}
                required
              />

              <TextInput
                label="支付方式"
                placeholder="请输入支付方式"
                value={editFormData.payment_method}
                onChange={(e) => setEditFormData(prev => ({ 
                  ...prev, 
                  payment_method: e.target.value 
                }))}
                leftSection={<IconCash size={16} />}
              />

              <Group justify="flex-end" gap="sm">
                <Button 
                  variant="light" 
                  onClick={closeEditInstallment}
                  disabled={editInstallmentLoading}
                >
                  取消
                </Button>
                <Button 
                  color="blue"
                  onClick={handleConfirmUpdateInstallment}
                  loading={editInstallmentLoading}
                  leftSection={<IconEdit size={16} />}
                >
                  确认更新
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* 审核订单弹窗 */}
        <Modal
          opened={reviewOpened}
          onClose={closeReview}
          title="订单审核"
          size="lg"
        >
          {reviewingOrder && (
            <Stack gap="md">
              <Box>
                <Text size="sm" c="dimmed" mb="xs">订单信息</Text>
                <Card withBorder p="sm" bg="gray.0">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">订单号:</Text>
                      <Text size="sm" fw={500}>{reviewingOrder.order_no}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">商品名称:</Text>
                      <Text size="sm">{reviewingOrder.product_name}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">用户:</Text>
                      <Text size="sm">{getUserDisplayName(reviewingOrder)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">当前状态:</Text>
                      <Badge
                        color={statusMap[reviewingOrder.status as keyof typeof statusMap]?.color || 'gray'}
                        variant="filled"
                      >
                        {statusMap[reviewingOrder.status as keyof typeof statusMap]?.label || reviewingOrder.status}
                      </Badge>
                    </Group>
                  </Stack>
                </Card>
              </Box>

              <Box>
                <Text size="sm" c="dimmed" mb="xs">审核材料</Text>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Card withBorder p="sm">
                      <Stack gap="xs" align="center">
                        <IconPhoto size={24} color="gray" />
                        <Text size="xs" c="dimmed" ta="center">人车合一照片</Text>
                        {reviewingOrder.rencheheyi_image ? (
                          <img 
                            src={reviewingOrder.rencheheyi_image} 
                            alt="人车合一照片"
                            style={{ 
                              width: '100%', 
                              height: '120px', 
                              objectFit: 'cover', 
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleImagePreview(reviewingOrder.rencheheyi_image!)}
                          />
                        ) : (
                          <Box 
                            style={{ 
                              width: '100%', 
                              height: '120px', 
                              backgroundColor: '#f1f3f4', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                          >
                            <Text size="xs" c="dimmed">未上传</Text>
                          </Box>
                        )}
                      </Stack>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Card withBorder p="sm">
                      <Stack gap="xs" align="center">
                        <IconPhoto size={24} color="gray" />
                        <Text size="xs" c="dimmed" ta="center">车架号照片</Text>
                        {reviewingOrder.chejiahao_image ? (
                          <img 
                            src={reviewingOrder.chejiahao_image} 
                            alt="车架号照片"
                            style={{ 
                              width: '100%', 
                              height: '120px', 
                              objectFit: 'cover', 
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleImagePreview(reviewingOrder.chejiahao_image!)}
                          />
                        ) : (
                          <Box 
                            style={{ 
                              width: '100%', 
                              height: '120px', 
                              backgroundColor: '#f1f3f4', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                          >
                            <Text size="xs" c="dimmed">未上传</Text>
                          </Box>
                        )}
                      </Stack>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Card withBorder p="sm">
                      <Stack gap="xs" align="center">
                        <IconPhoto size={24} color="gray" />
                        <Text size="xs" c="dimmed" ta="center">芝麻信用照片</Text>
                        {reviewingOrder.zhimaxinyong_image ? (
                          <img 
                            src={reviewingOrder.zhimaxinyong_image} 
                            alt="芝麻信用照片"
                            style={{ 
                              width: '100%', 
                              height: '120px', 
                              objectFit: 'cover', 
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleImagePreview(reviewingOrder.zhimaxinyong_image!)}
                          />
                        ) : (
                          <Box 
                            style={{ 
                              width: '100%', 
                              height: '120px', 
                              backgroundColor: '#f1f3f4', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                          >
                            <Text size="xs" c="dimmed">未上传</Text>
                          </Box>
                        )}
                      </Stack>
                    </Card>
                  </Grid.Col>
                </Grid>
              </Box>

              <TextInput
                label="审核备注（可选）"
                placeholder="请输入审核备注"
                value={reviewRemark}
                onChange={(e) => setReviewRemark(e.target.value)}
              />

              <Group justify="flex-end" gap="sm">
                <Button 
                  variant="light" 
                  color="gray"
                  onClick={closeReview}
                  disabled={reviewLoading}
                >
                  取消
                </Button>
                <Button 
                  variant="filled"
                  color="red"
                  onClick={() => handleConfirmReview('reject')}
                  loading={reviewLoading}
                  leftSection={<IconX size={16} />}
                >
                  拒绝
                </Button>
                <Button 
                  variant="filled"
                  color="teal"
                  onClick={() => handleConfirmReview('approve')}
                  loading={reviewLoading}
                  leftSection={<IconCheck size={16} />}
                >
                  通过
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* 图片预览弹窗 */}
        <Modal
          opened={imagePreviewOpened}
          onClose={closeImagePreview}
          title="图片预览"
          size="xl"
          centered
        >
          <Box style={{ textAlign: 'center' }}>
            {previewImageUrl && (
              <img 
                src={previewImageUrl} 
                alt="预览图片"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '70vh', 
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
              />
            )}
          </Box>
        </Modal>
      </Stack>
    </Container>
  );
}
