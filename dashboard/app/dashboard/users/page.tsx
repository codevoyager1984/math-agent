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
  Avatar,
  Title,
} from '@mantine/core';
import { 
  IconEye, 
  IconSearch, 
  IconRefresh, 
  IconEdit,
  IconUser,
  IconPhone,
  IconCertificate,
  IconId,
  IconShieldCheck,
  IconShieldX
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import { useDisclosure } from '@mantine/hooks';
import { toast } from 'sonner';
import { modals } from '@mantine/modals';
import PageHeader from '@/components/PageHeader/PageHeader';
import { formatTimestamp } from '@/utils';
import { 
  getUsers, 
  getUser,
  updateUser,
  getUserOrders,
  User, 
  UserListParams,
  UserListResponse,
  UserUpdateRequest
} from '@/api/user';
import { Order } from '@/api/order';

const RECORDS_PER_PAGE = 20;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [certifiedFilter, setCertifiedFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [editForm, setEditForm] = useState<UserUpdateRequest>({});

  // 获取用户列表
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: UserListParams = {
        page,
        limit: RECORDS_PER_PAGE,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (certifiedFilter !== 'all') {
        params.is_certified = certifiedFilter === 'certified';
      }

      const response = await getUsers(params);
      setUsers(response.users);
      setTotalRecords(response.total);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, certifiedFilter]);

  // 初始加载和依赖更新时获取数据
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 搜索处理
  const handleSearch = () => {
    setPage(1); // 重置到第一页
  };

  // 重置搜索
  const handleReset = () => {
    setSearch('');
    setCertifiedFilter('all');
    setPage(1);
  };

  // 查看用户详情
  const handleViewDetail = async (user: User) => {
    try {
      // 获取用户详细信息
      const userDetail = await getUser(user.id);
      setSelectedUser(userDetail);
      
      // 获取用户订单
      const ordersResponse = await getUserOrders(user.id, { page: 1, limit: 10 });
      setUserOrders(ordersResponse.orders);
      
      openDetail();
    } catch (error) {
      console.error('获取用户详情失败:', error);
      toast.error('获取用户详情失败');
    }
  };

  // 编辑用户
  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      nickname: user.nickname || '',
      phone: user.phone || '',
      is_certified: user.is_certified,
      id_card_number: user.id_card_number || '',
      id_card_name: user.id_card_name || '',
      contact_address: user.contact_address || '',
      emergency_contact_name: user.emergency_contact_name || '',
      emergency_contact_phone: user.emergency_contact_phone || '',
      email: user.email || '',
      social_account: user.social_account || '',
    });
    openEdit();
  };

  // 保存用户编辑
  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    
    try {
      await updateUser(selectedUser.id, editForm);
      toast.success('用户信息更新成功');
      closeEdit();
      fetchUsers(); // 刷新列表
    } catch (error) {
      console.error('更新用户失败:', error);
      toast.error('更新用户失败');
    }
  };

  const formatDate = (dateString?: string) => {
    return formatTimestamp.dateTime(dateString);
  };

  return (
    <Container fluid>
      <Stack gap="lg">
        <PageHeader title="用户管理" />

        {/* 搜索和筛选 */}
        <Card withBorder p="md">
          <Stack gap="md">
            <Group align="flex-end" gap="md">
              <TextInput
                label="搜索"
                placeholder="搜索昵称、手机号、支付宝ID或身份证姓名"
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
                label="认证状态"
                placeholder="选择认证状态"
                value={certifiedFilter}
                onChange={(value) => setCertifiedFilter(value || 'all')}
                data={[
                  { value: 'all', label: '全部状态' },
                  { value: 'certified', label: '已认证' },
                  { value: 'uncertified', label: '未认证' },
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
              共 {totalRecords} 个用户
            </Text>
          </Group>
          <Button 
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={fetchUsers}
          >
            刷新
          </Button>
        </Group>

        {/* 用户表格 */}
        <Card withBorder>
          <div style={{ position: 'relative' }}>
            <LoadingOverlay visible={loading} />
            <DataTable
              withTableBorder={false}
              records={users}
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
                  accessor: 'user_info',
                  title: '用户信息',
                  width: 250,
                  render: (record) => (
                    <Group gap="sm">
                      <Avatar 
                        src={record.avatar_url} 
                        size="sm" 
                        radius="xl"
                      >
                        <IconUser size={16} />
                      </Avatar>
                      <Stack gap={2}>
                        <Text size="sm" fw={500}>
                          {record.nickname || '未设置昵称'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          ID: {record.id}
                        </Text>
                      </Stack>
                    </Group>
                  ),
                },
                {
                  accessor: 'phone',
                  title: '手机号',
                  width: 120,
                  render: (record) => (
                    <Group gap="xs">
                      <IconPhone size={14} />
                      <Text size="sm">{record.phone || '-'}</Text>
                    </Group>
                  ),
                },
                {
                  accessor: 'alipay_open_id',
                  title: '支付宝ID',
                  width: 150,
                  render: (record) => (
                    <Text size="sm" lineClamp={1} title={record.alipay_open_id}>
                      {record.alipay_open_id || '-'}
                    </Text>
                  ),
                },
                {
                  accessor: 'is_certified',
                  title: '认证状态',
                  width: 120,
                  textAlign: 'center',
                  render: (record) => (
                    <Badge
                      color={record.is_certified ? 'green' : 'orange'}
                      variant="light"
                      leftSection={
                        record.is_certified ? (
                          <IconShieldCheck size={12} />
                        ) : (
                          <IconShieldX size={12} />
                        )
                      }
                    >
                      {record.is_certified ? '已认证' : '未认证'}
                    </Badge>
                  ),
                },
                {
                  accessor: 'id_card_name',
                  title: '身份证姓名',
                  width: 120,
                  render: (record) => (
                    <Group gap="xs">
                      <IconId size={14} />
                      <Text size="sm">{record.id_card_name || '-'}</Text>
                    </Group>
                  ),
                },
                {
                  accessor: 'created_at',
                  title: '注册时间',
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
                        color="orange"
                        size="sm"
                        onClick={() => handleEdit(record)}
                      >
                        <IconEdit size={14} />
                      </ActionIcon>
                    </Group>
                  ),
                },
              ]}
              striped
              highlightOnHover
              minHeight={400}
              noRecordsText="暂无用户数据"
              loadingText="加载中..."
            />
          </div>
        </Card>

        {/* 用户详情弹窗 */}
        <Modal
          opened={detailOpened}
          onClose={closeDetail}
          title="用户详情"
          size="xl"
        >
          {selectedUser && (
            <Stack gap="md">
              <Group align="flex-start" gap="md">
                <Avatar 
                  src={selectedUser.avatar_url} 
                  size="xl" 
                  radius="xl"
                >
                  <IconUser size={40} />
                </Avatar>
                <Stack gap="sm" style={{ flex: 1 }}>
                  <Title order={3}>{selectedUser.nickname || '未设置昵称'}</Title>
                  <Group gap="md">
                    <Badge
                      color={selectedUser.is_certified ? 'green' : 'orange'}
                      variant="light"
                      leftSection={
                        selectedUser.is_certified ? (
                          <IconShieldCheck size={12} />
                        ) : (
                          <IconShieldX size={12} />
                        )
                      }
                    >
                      {selectedUser.is_certified ? '已认证' : '未认证'}
                    </Badge>
                  </Group>
                </Stack>
              </Group>

              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">用户ID</Text>
                  <Text fw={500}>{selectedUser.id}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">手机号</Text>
                  <Text>{selectedUser.phone || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={12}>
                  <Text size="sm" c="dimmed">支付宝OpenID</Text>
                  <Text style={{ wordBreak: 'break-all' }}>
                    {selectedUser.alipay_open_id || '-'}
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">身份证姓名</Text>
                  <Text>{selectedUser.id_card_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">身份证号</Text>
                  <Text>{selectedUser.id_card_number || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">注册时间</Text>
                  <Text>{formatDate(selectedUser.created_at)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">更新时间</Text>
                  <Text>{formatDate(selectedUser.updated_at)}</Text>
                </Grid.Col>
                <Grid.Col span={12}>
                  <Text size="sm" c="dimmed">联系地址</Text>
                  <Text>{selectedUser.contact_address || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">紧急联系人姓名</Text>
                  <Text>{selectedUser.emergency_contact_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">紧急联系人电话</Text>
                  <Text>{selectedUser.emergency_contact_phone || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">邮箱</Text>
                  <Text>{selectedUser.email || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">即时通讯账号</Text>
                  <Text>{selectedUser.social_account || '-'}</Text>
                </Grid.Col>
              </Grid>

              <Divider />
              
              <Box>
                <Text size="sm" fw={500} mb="sm">最近订单</Text>
                {userOrders.length > 0 ? (
                  <DataTable
                    withTableBorder={false}
                    records={userOrders}
                    columns={[
                      {
                        accessor: 'order_no',
                        title: '订单号',
                        width: 300,
                        render: (order) => (
                          <Text size="sm" fw={500}>{order.order_no}</Text>
                        ),
                      },
                      {
                        accessor: 'product_name',
                        title: '商品',
                        render: (order) => (
                          <Text size="sm">{order.product_name}</Text>
                        ),
                      },
                      {
                        accessor: 'total_amount',
                        title: '总金额',
                        width: 100,
                        render: (order) => (
                          <Text size="sm" c="green">¥{order.total_amount.toFixed(2)}</Text>
                        ),
                      },
                      {
                        accessor: 'status',
                        title: '状态',
                        width: 100,
                        render: (order) => (
                          <Badge size="sm" color={
                            order.status === 'completed' ? 'green' :
                            order.status === 'paid' ? 'blue' :
                            order.status === 'cancelled' ? 'gray' : 'orange'
                          }>
                            {order.status === 'pending' ? '待付款' :
                             order.status === 'paid' ? '已付款' :
                             order.status === 'cancelled' ? '已取消' : '已完成'}
                          </Badge>
                        ),
                      },
                    ]}
                    minHeight={0}
                  />
                ) : (
                  <Text size="sm" c="dimmed">暂无订单</Text>
                )}
              </Box>
            </Stack>
          )}
        </Modal>

        {/* 用户编辑弹窗 */}
        <Modal
          opened={editOpened}
          onClose={closeEdit}
          title="编辑用户信息"
          size="md"
        >
          {selectedUser && (
            <Stack gap="md">
              <TextInput
                label="昵称"
                placeholder="请输入昵称"
                value={editForm.nickname || ''}
                onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
              />
              <TextInput
                label="手机号"
                placeholder="请输入手机号"
                value={editForm.phone || ''}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
              <Select
                label="认证状态"
                placeholder="选择认证状态"
                value={editForm.is_certified ? 'true' : 'false'}
                onChange={(value) => setEditForm({ ...editForm, is_certified: value === 'true' })}
                data={[
                  { value: 'true', label: '已认证' },
                  { value: 'false', label: '未认证' },
                ]}
              />
              <TextInput
                label="身份证姓名"
                placeholder="请输入身份证姓名"
                value={editForm.id_card_name || ''}
                onChange={(e) => setEditForm({ ...editForm, id_card_name: e.target.value })}
              />
              <TextInput
                label="身份证号"
                placeholder="请输入身份证号"
                value={editForm.id_card_number || ''}
                onChange={(e) => setEditForm({ ...editForm, id_card_number: e.target.value })}
              />
              <TextInput
                label="联系地址"
                placeholder="请输入联系地址"
                value={editForm.contact_address || ''}
                onChange={(e) => setEditForm({ ...editForm, contact_address: e.target.value })}
              />
              <TextInput
                label="紧急联系人姓名"
                placeholder="请输入紧急联系人姓名"
                value={editForm.emergency_contact_name || ''}
                onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })}
              />
              <TextInput
                label="紧急联系人电话"
                placeholder="请输入紧急联系人电话"
                value={editForm.emergency_contact_phone || ''}
                onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })}
              />
              <TextInput
                label="邮箱"
                placeholder="请输入邮箱"
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
              <TextInput
                label="即时通讯账号"
                placeholder="请输入即时通讯账号"
                value={editForm.social_account || ''}
                onChange={(e) => setEditForm({ ...editForm, social_account: e.target.value })}
              />
              
              <Group justify="flex-end" gap="sm">
                <Button variant="light" onClick={closeEdit}>
                  取消
                </Button>
                <Button onClick={handleSaveEdit}>
                  保存
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Stack>
    </Container>
  );
}
