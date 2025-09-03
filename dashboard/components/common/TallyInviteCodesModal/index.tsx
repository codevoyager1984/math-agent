'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Paper,
  Title,
  Group,
  Stack,
  Text,
  Table,
  Badge,
  Card,
  Grid,
  Alert,
  Progress,
  ScrollArea,
  Divider,
  LoadingOverlay,
  Select,
} from '@mantine/core';
import {
  IconUsers,
  IconMail,
  IconCheck,
  IconX,
  IconUserPlus,
  IconChartPie,
  IconCode,
  IconAlertCircle,
} from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { type TaskExecution } from '../../../api/task';
import { batchQueryInviteCodes, type InviteCode } from '../../../api/invite';
import { notifications } from '@mantine/notifications';
import { formatDate } from 'date-fns/format';

interface TallyInviteCodesModalProps {
  opened: boolean;
  onClose: () => void;
  task: TaskExecution | null;
}

export default function TallyInviteCodesModal({ opened, onClose, task }: TallyInviteCodesModalProps) {
  const [taskResult, setTaskResult] = useState<any>(null);
  const [inviteCodeDetails, setInviteCodeDetails] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [bindingFilter, setBindingFilter] = useState<string>('all'); // 'all', 'bound', 'unbound'

  // 获取邀请码详情
  const fetchInviteCodeDetails = async (codes: string[]) => {
    try {
      setLoading(true);
      
      // 批量查询邀请码详情
      const inviteCodes = await batchQueryInviteCodes(codes);
      setInviteCodeDetails(inviteCodes);
    } catch (error) {
      console.error('获取邀请码详情失败:', error);
      notifications.show({
        title: '获取失败',
        message: '获取邀请码详情失败',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // 当任务改变时，解析任务结果
  useEffect(() => {
    if (task?.task_name === 'tally_invite_codes' && task.result && opened) {
      try {
        const result = task.result;
        console.log('Tally task result:', result);
        setTaskResult(result);
        
        // 如果有邀请码，获取详情
        if (result.successful_codes && Array.isArray(result.successful_codes)) {
          fetchInviteCodeDetails(result.successful_codes);
        }
      } catch (error) {
        console.error('Error parsing tally task result:', error);
      }
    }
  }, [task, opened]);

  // 格式化数字
  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN');
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 计算成功率
  const getSuccessRate = () => {
    if (!taskResult || taskResult.selected_users === 0) return 0;
    return Math.round((taskResult.sent_count / taskResult.selected_users) * 100);
  };

  // 生成统计图表数据
  const getChartData = () => {
    if (!taskResult) return [];
    
    return [
      {
        name: '成功发送',
        value: taskResult.sent_count || 0,
        color: '#51cf66'
      },
      {
        name: '发送失败',
        value: taskResult.failed_count || 0,
        color: '#ff6b6b'
      }
    ];
  };

  // 生成用户统计数据
  const getUserStatsData = () => {
    if (!taskResult) return [];
    
    return [
      {
        name: '新用户',
        value: taskResult.new_users || 0,
        color: '#339af0'
      },
      {
        name: '老用户',
        value: (taskResult.total_users || 0) - (taskResult.new_users || 0),
        color: '#ffd43b'
      }
    ];
  };

  // 生成绑定趋势数据
  const generateBindingTrendData = () => {
    if (!inviteCodeDetails || inviteCodeDetails.length === 0) return [];
    
    // 按天分组统计绑定情况
    const bindingByDay = new Map<string, { date: string; bound: number; cumulative: number }>();
    
    // 统计每天的绑定数
    inviteCodeDetails.forEach(code => {
      if (code.used && code.bindAt) {
        const date = new Date(code.bindAt).toISOString().split('T')[0];
        if (!bindingByDay.has(date)) {
          bindingByDay.set(date, { date, bound: 0, cumulative: 0 });
        }
        bindingByDay.get(date)!.bound += 1;
      }
    });

    // 转换为数组并排序
    const sortedData = Array.from(bindingByDay.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 计算累计绑定数
    let cumulativeBound = 0;
    sortedData.forEach(item => {
      cumulativeBound += item.bound;
      item.cumulative = cumulativeBound;
    });

    return sortedData.map(item => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    }));
  };

  // 计算绑定统计
  const getBindingStats = () => {
    const totalCodes = inviteCodeDetails.length;
    const boundCodes = inviteCodeDetails.filter(code => code.used).length;
    const unboundCodes = totalCodes - boundCodes;
    
    return {
      total: totalCodes,
      bound: boundCodes,
      unbound: unboundCodes,
      bindingRate: totalCodes > 0 ? Math.round((boundCodes / totalCodes) * 100) : 0,
    };
  };

  // 获取筛选后的邮箱列表
  const getFilteredEmails = () => {
    if (!taskResult.successful_emails || !Array.isArray(taskResult.successful_emails)) {
      return [];
    }

    return taskResult.successful_emails.filter((email: string, index: number) => {
      const inviteCode = taskResult.successful_codes?.[index];
      const codeDetail = inviteCodeDetails.find(detail => detail.code === inviteCode);
      
      if (bindingFilter === 'all') return true;
      if (bindingFilter === 'bound') return codeDetail?.used === true;
      if (bindingFilter === 'unbound') return codeDetail?.used === false || !codeDetail;
      
      return true;
    }).map((email: string, originalIndex: number) => ({
      email,
      originalIndex: taskResult.successful_emails.indexOf(email)
    }));
  };

  const chartData = getChartData();
  const userStatsData = getUserStatsData();
  const successRate = getSuccessRate();
  const bindingTrendData = generateBindingTrendData();
  const bindingStats = getBindingStats();

  if (!taskResult) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title="Tally 邀请码任务详情"
        centered
        size="1400px"
      >
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="暂无数据"
          color="gray"
          variant="light"
        >
          无法加载任务详情数据
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Tally 邀请码任务详情"
      centered
      size="1400px"
    >
      <LoadingOverlay visible={loading} />
      
      <Stack gap="md">
        {/* 任务执行统计 */}
        <Paper withBorder p="md">
          <Title order={5} mb="md">任务执行统计</Title>
          <Grid>
            <Grid.Col span={2.4}>
              <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                  <IconUsers size={28} color="blue" />
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">总邮箱</Text>
                  <Text size="xl" fw={700} c="blue">{formatNumber(taskResult.total_users || 0)}</Text>
                </Stack>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={2.4}>
              <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                  <IconUserPlus size={28} color="green" />
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">新邮箱</Text>
                  <Text size="xl" fw={700} c="green">{formatNumber(taskResult.new_users || 0)}</Text>
                </Stack>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={2.4}>
              <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                  <IconMail size={28} color="orange" />
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">选中发送</Text>
                  <Text size="xl" fw={700} c="orange">{formatNumber(taskResult.selected_users || 0)}</Text>
                </Stack>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={2.4}>
              <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                  <IconCheck size={28} color="indigo" />
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">成功发送</Text>
                  <Text size="xl" fw={700} c="indigo">{formatNumber(taskResult.sent_count || 0)}</Text>
                </Stack>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={2.4}>
              <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                  <IconCode size={28} color="teal" />
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">绑定率</Text>
                  <Text size="xl" fw={700} c="teal">{bindingStats.bindingRate}%</Text>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
          
          {/* 发送成功率和绑定率进度条 */}
          <Grid mt="md">
            <Grid.Col span={6}>
              <Card withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Group align="center" gap="xs">
                      <IconMail size={18} color="green" />
                      <Text size="sm" fw={600}>发送成功率</Text>
                    </Group>
                    <Text size="sm" c="dimmed" fw={500}>
                      {taskResult.sent_count || 0} / {taskResult.selected_users || 0}
                    </Text>
                  </Group>
                  <Progress 
                    value={successRate} 
                    color="green" 
                    size="lg" 
                    radius="md"
                  />
                  <Text size="xs" c="dimmed" ta="center" fw={500}>
                    {successRate}% 发送成功
                  </Text>
                </Stack>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={6}>
              <Card withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Group align="center" gap="xs">
                      <IconCode size={18} color="teal" />
                      <Text size="sm" fw={600}>邀请码绑定率</Text>
                    </Group>
                    <Text size="sm" c="dimmed" fw={500}>
                      {bindingStats.bound} / {bindingStats.total}
                    </Text>
                  </Group>
                  <Progress 
                    value={bindingStats.bindingRate} 
                    color="teal" 
                    size="lg" 
                    radius="md"
                  />
                  <Text size="xs" c="dimmed" ta="center" fw={500}>
                    {bindingStats.bindingRate}% 已绑定
                  </Text>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* 邀请码绑定趋势图 */}
        {bindingTrendData.length > 0 && (
          <Paper withBorder p="md">
            <Title order={5} mb="md">邀请码绑定趋势</Title>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={bindingTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="bound" 
                    stroke="#51cf66" 
                    strokeWidth={2}
                    name="当日绑定数"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cumulative" 
                    stroke="#339af0" 
                    strokeWidth={2}
                    name="累计绑定数"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Paper>
        )}

        {/* 详细统计 */}
        <Grid>
          <Grid.Col span={4}>
            <Card withBorder p="md">
              <Text size="sm" fw={500} mb="md">发送统计详情</Text>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group align="center" gap="xs">
                    <IconCheck size={16} color="green" />
                    <Text size="sm" c="dimmed">成功发送</Text>
                  </Group>
                  <Text size="sm" fw={500} c="green">
                    {formatNumber(taskResult.sent_count || 0)} 封
                  </Text>
                </Group>
                
                <Group justify="space-between">
                  <Group align="center" gap="xs">
                    <IconX size={16} color="red" />
                    <Text size="sm" c="dimmed">发送失败</Text>
                  </Group>
                  <Text size="sm" fw={500} c="red">
                    {formatNumber(taskResult.failed_count || 0)} 封
                  </Text>
                </Group>
                
                <Divider />
                
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">成功率</Text>
                  <Text size="sm" fw={500}>
                    {successRate}%
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
          
          <Grid.Col span={4}>
            <Card withBorder p="md">
              <Text size="sm" fw={500} mb="md">邀请码绑定统计</Text>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group align="center" gap="xs">
                    <IconCode size={16} color="blue" />
                    <Text size="sm" c="dimmed">总邀请码</Text>
                  </Group>
                  <Text size="sm" fw={500} c="blue">
                    {formatNumber(bindingStats.total)} 个
                  </Text>
                </Group>
                
                <Group justify="space-between">
                  <Group align="center" gap="xs">
                    <IconCheck size={16} color="green" />
                    <Text size="sm" c="dimmed">已绑定</Text>
                  </Group>
                  <Text size="sm" fw={500} c="green">
                    {formatNumber(bindingStats.bound)} 个
                  </Text>
                </Group>
                
                <Divider />
                
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">绑定率</Text>
                  <Text size="sm" fw={500}>
                    {bindingStats.bindingRate}%
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
          
          <Grid.Col span={4}>
            <Card withBorder p="md">
              <Text size="sm" fw={500} mb="md">用户统计详情</Text>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group align="center" gap="xs">
                    <IconUsers size={16} color="blue" />
                    <Text size="sm" c="dimmed">总邮箱</Text>
                  </Group>
                  <Text size="sm" fw={500} c="blue">
                    {formatNumber(taskResult.total_users || 0)}
                  </Text>
                </Group>
                
                <Group justify="space-between">
                  <Group align="center" gap="xs">
                    <IconUserPlus size={16} color="green" />
                    <Text size="sm" c="dimmed">未发送过邀请的邮箱</Text>
                  </Group>
                  <Text size="sm" fw={500} c="green">
                    {formatNumber(taskResult.new_users || 0)}
                  </Text>
                </Group>
                
                <Divider />
                
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">新用户占比</Text>
                  <Text size="sm" fw={500}>
                    {taskResult.total_users > 0 ? 
                      Math.round((taskResult.new_users / taskResult.total_users) * 100) : 0
                    }%
                  </Text>
                </Group>
                
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">选中用户数</Text>
                  <Text size="sm" fw={500}>
                    {formatNumber(taskResult.selected_users || 0)}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* 成功邮箱列表 */}
        {taskResult.successful_emails && taskResult.successful_emails.length > 0 && (
          <Paper withBorder p="md">
            <Group align="center" justify="space-between" mb="md">
              <Group align="center" gap="sm">
                <IconMail size={20} color="green" />
                <Title order={5}>成功发送邮箱列表</Title>
                <Badge color="green" variant="light">
                  {taskResult.successful_emails.length} 个
                </Badge>
              </Group>
              
              <Select
                placeholder="筛选绑定状态"
                value={bindingFilter}
                onChange={(value) => setBindingFilter(value || 'all')}
                data={[
                  { value: 'all', label: '全部' },
                  { value: 'bound', label: '已绑定' },
                  { value: 'unbound', label: '未绑定' },
                ]}
                style={{ minWidth: 120 }}
              />
            </Group>
            
            <ScrollArea h={200}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>序号</Table.Th>
                    <Table.Th>邮箱地址</Table.Th>
                    <Table.Th>对应邀请码</Table.Th>
                    <Table.Th>绑定状态</Table.Th>
                    <Table.Th>绑定时间</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                
                <Table.Tbody>
                  {getFilteredEmails().map((emailData: { email: string; originalIndex: number }, index: number) => {
                    const { email, originalIndex } = emailData;
                    const inviteCode = taskResult.successful_codes?.[originalIndex];
                    const codeDetail = inviteCodeDetails.find(detail => detail.code === inviteCode);

                    // 邮箱打码函数，只显示前2位和域名
                    const maskEmail = (email: string) => {
                      if (!email || !email.includes('@')) return email;
                      const [name, domain] = email.split('@');
                      if (name.length <= 2) {
                        return name[0] + '*'.repeat(Math.max(0, name.length - 1)) + '@' + domain;
                      }
                      return name.slice(0, 2) + '*'.repeat(name.length - 2) + '@' + domain;
                    };

                    return (
                      <Table.Tr key={originalIndex}>
                        <Table.Td>
                          <Text size="sm">{index + 1}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" ff="monospace">{maskEmail(email)}</Text>
                        </Table.Td>
                        <Table.Td>
                          {inviteCode ? (
                            <Badge color="blue" variant="light" ff="monospace">
                              {inviteCode}
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {codeDetail ? (
                            <Badge 
                              color={codeDetail.used ? 'green' : 'gray'} 
                              variant="light"
                              size="sm"
                            >
                              {codeDetail.used ? '已绑定' : '未绑定'}
                            </Badge>
                          ) : (
                            <Badge color="gray" variant="light" size="sm">
                              未知
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {codeDetail?.used && codeDetail.bindAt ? (
                            <Text size="sm">{formatDate(codeDetail.bindAt)}</Text>
                          ) : (
                            <Text size="sm" c="dimmed">-</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        )}

        {/* 邀请码列表 */}
        {taskResult.successful_codes && taskResult.successful_codes.length > 0 && (
          <Paper withBorder p="md">
            <Group align="center" gap="sm" mb="md">
              <IconCode size={20} color="blue" />
              <Title order={5}>生成的邀请码</Title>
              <Badge color="blue" variant="light">
                {taskResult.successful_codes.length} 个
              </Badge>
            </Group>
            
            <ScrollArea h={150}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                gap: '8px' 
              }}>
                {taskResult.successful_codes.map((code: string, index: number) => (
                  <Badge 
                    key={index} 
                    color="blue" 
                    variant="light" 
                    ff="monospace"
                    size="sm"
                  >
                    {code}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </Paper>
        )}
      </Stack>
    </Modal>
  );
} 