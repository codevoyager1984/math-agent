'use client';

import { useEffect, useState } from 'react';
import {
  IconAlertCircle,
  IconChartLine,
  IconCircleCheck,
  IconCircleX,
  IconClock2,
  IconUsers,
} from '@tabler/icons-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Alert,
  Badge,
  Card,
  Grid,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  Progress,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { batchQueryInviteCodes, type InviteCode } from '../../../api/invite';
import { type TaskExecution } from '../../../api/task';

interface InviteCodeDetailsModalProps {
  opened: boolean;
  onClose: () => void;
  task: TaskExecution | null;
}

export default function InviteCodeDetailsModal({
  opened,
  onClose,
  task,
}: InviteCodeDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [inviteCodeDetails, setInviteCodeDetails] = useState<InviteCode[]>([]);
  const [taskResult, setTaskResult] = useState<any>(null);

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

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 计算邀请码统计数据
  const calculateInviteCodeStats = (codes: InviteCode[]) => {
    const total = codes.length;
    const used = codes.filter((c) => c.used).length;
    const unused = codes.filter((c) => !c.used).length;
    const sent = codes.filter((c) => c.sentOut).length;
    const unsent = codes.filter((c) => !c.sentOut).length;

    return {
      total,
      used,
      unused,
      sent,
      unsent,
      usageRate: total > 0 ? Math.round((used / total) * 100) : 0,
      sentRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    };
  };

  // 生成时间趋势数据
  const generateTrendData = (codes: InviteCode[]) => {
    // 按天分组统计使用情况
    const usageByDay = new Map<
      string,
      { date: string; used: number; total: number; cumulative: number }
    >();

    // 先统计每天的总数（按创建时间）
    codes.forEach((code) => {
      const date = new Date(code.createdAt).toISOString().split('T')[0];
      if (!usageByDay.has(date)) {
        usageByDay.set(date, { date, used: 0, total: 0, cumulative: 0 });
      }
      usageByDay.get(date)!.total += 1;
    });

    // 再统计每天的使用情况（按绑定时间）
    codes.forEach((code) => {
      if (code.used && code.bindAt) {
        const date = new Date(code.bindAt).toISOString().split('T')[0];
        if (!usageByDay.has(date)) {
          usageByDay.set(date, { date, used: 0, total: 0, cumulative: 0 });
        }
        usageByDay.get(date)!.used += 1;
      }
    });

    // 转换为数组并排序
    const sortedData = Array.from(usageByDay.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 计算累计使用数
    let cumulativeUsed = 0;
    sortedData.forEach((item) => {
      cumulativeUsed += item.used;
      item.cumulative = cumulativeUsed;
    });

    return sortedData.map((item) => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      usageRate: item.total > 0 ? Math.round((item.used / item.total) * 100) : 0,
    }));
  };

  // 当任务改变时，获取邀请码详情
  useEffect(() => {
    if (task?.task_name === 'discord_invite_codes' && task.result && opened) {
      try {
        const result = task.result;
        console.log('Task result:', result);
        setTaskResult(result);

        if (result.codes && Array.isArray(result.codes)) {
          console.log('Found codes:', result.codes);
          fetchInviteCodeDetails(result.codes);
        } else {
          console.log('No codes found in result:', result);
          notifications.show({
            title: '数据格式错误',
            message: '任务结果中没有邀请码数据',
            color: 'orange',
            icon: <IconAlertCircle size={16} />,
          });
        }
      } catch (error) {
        console.error('Error:', error);
        notifications.show({
          title: '处理失败',
          message: `处理任务结果数据失败: ${error}`,
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
      }
    }
  }, [task, opened]);

  const stats = calculateInviteCodeStats(inviteCodeDetails);
  const trendData = generateTrendData(inviteCodeDetails);

  return (
    <Modal opened={opened} onClose={onClose} title="Discord 邀请码详情" centered size="1400px">
      <LoadingOverlay visible={loading} />

      <Stack gap="md">
        {/* 任务结果统计 */}
        {taskResult && (
          <Paper withBorder p="md">
            <Title order={5} mb="md">
              任务执行统计
            </Title>
            <Grid>
              <Grid.Col span={2.4}>
                <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                  <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                    <IconUsers size={28} color="blue" />
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase">发送数量</Text>
                    <Text size="xl" fw={700} c="blue">{taskResult.sent_codes || 0}</Text>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={2.4}>
                <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                  <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                    <IconCircleCheck size={28} color="green" />
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase">已使用</Text>
                    <Text size="xl" fw={700} c="green">{stats.used}</Text>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={2.4}>
                <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                  <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                    <IconCircleX size={28} color="orange" />
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase">未使用</Text>
                    <Text size="xl" fw={700} c="orange">{stats.unused}</Text>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={2.4}>
                <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                  <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                    <IconClock2 size={28} color="indigo" />
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase">已发送</Text>
                    <Text size="xl" fw={700} c="indigo">{stats.sent}</Text>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={2.4}>
                <Card withBorder p="sm" radius="md" style={{ height: '100%' }}>
                  <Stack gap="xs" ta="center" justify="center" style={{ height: '100%' }}>
                    <IconChartLine size={28} color="teal" />
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase">使用率</Text>
                    <Text size="xl" fw={700} c="teal">{stats.usageRate}%</Text>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            {/* 使用率和发送率进度条 */}
            <Grid mt="md">
              <Grid.Col span={6}>
                <Card withBorder p="md" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="center">
                      <Group align="center" gap="xs">
                        <IconCircleCheck size={18} color="green" />
                        <Text size="sm" fw={600}>使用率</Text>
                      </Group>
                      <Text size="sm" c="dimmed" fw={500}>
                        {stats.used} / {stats.total}
                      </Text>
                    </Group>
                    <Progress 
                      value={stats.usageRate} 
                      color="green" 
                      size="lg" 
                      radius="md"
                    />
                    <Text size="xs" c="dimmed" ta="center" fw={500}>
                      {stats.usageRate}% 已使用
                    </Text>
                  </Stack>
                </Card>
              </Grid.Col>
              
              <Grid.Col span={6}>
                <Card withBorder p="md" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="center">
                      <Group align="center" gap="xs">
                        <IconClock2 size={18} color="blue" />
                        <Text size="sm" fw={600}>发送率</Text>
                      </Group>
                      <Text size="sm" c="dimmed" fw={500}>
                        {stats.sent} / {stats.total}
                      </Text>
                    </Group>
                    <Progress 
                      value={stats.sentRate} 
                      color="blue" 
                      size="lg" 
                      radius="md"
                    />
                    <Text size="xs" c="dimmed" ta="center" fw={500}>
                      {stats.sentRate}% 已发送
                    </Text>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Paper>
        )}

        {/* 时间趋势图 */}
        <Paper withBorder p="md">
          <Title order={5} mb="md">
            使用趋势分析
          </Title>

          <Grid>
            <Grid.Col span={12}>
              <Card withBorder p="md">
                <Text size="sm" fw={500} mb="md">
                  邀请码使用趋势
                </Text>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="used"
                        stroke="#51cf66"
                        strokeWidth={2}
                        name="当日使用数"
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulative"
                        stroke="#339af0"
                        strokeWidth={2}
                        name="累计使用数"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* 邀请码列表 */}
        <Paper withBorder>
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>邀请码</Table.Th>
                  <Table.Th>状态</Table.Th>
                  <Table.Th>使用者</Table.Th>
                  <Table.Th>绑定时间</Table.Th>
                  <Table.Th>发送状态</Table.Th>
                  <Table.Th>创建时间</Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {inviteCodeDetails.map((code) => (
                  <Table.Tr key={code.id}>
                    <Table.Td>
                      <Text ff="monospace" fw={500}>
                        {code.code}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      <Badge color={code.used ? 'green' : 'gray'} variant="light" size="sm">
                        {code.used ? '已使用' : '未使用'}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      {code.connectedUserEmail ? (
                        <Text size="sm">{code.connectedUserEmail}</Text>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      {code.bindAt ? (
                        <Text size="sm">{formatDate(code.bindAt)}</Text>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      <Badge color={code.sentOut ? 'blue' : 'orange'} variant="light" size="sm">
                        {code.sentOut ? '已发送' : '未发送'}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <Text size="sm">{formatDate(code.createdAt)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          {inviteCodeDetails.length === 0 && !loading && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="暂无数据"
              color="gray"
              variant="light"
              style={{ margin: '20px' }}
            >
              没有找到邀请码详情数据
            </Alert>
          )}
        </Paper>

        {/* 使用统计汇总 */}
        {inviteCodeDetails.length > 0 && (
          <Paper withBorder p="md">
            <Title order={5} mb="md">
              统计汇总
            </Title>

            <Grid>
              <Grid.Col span={6}>
                <Card withBorder p="sm">
                  <Text size="sm" fw={500} mb="xs">
                    使用率统计
                  </Text>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        已使用
                      </Text>
                      <Text size="xs" fw={500} c="green">
                        {stats.used} 个
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        未使用
                      </Text>
                      <Text size="xs" fw={500} c="orange">
                        {stats.unused} 个
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        使用率
                      </Text>
                      <Text size="xs" fw={500}>
                        {stats.usageRate}%
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={6}>
                <Card withBorder p="sm">
                  <Text size="sm" fw={500} mb="xs">
                    发送状态
                  </Text>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        已发送
                      </Text>
                      <Text size="xs" fw={500} c="blue">
                        {stats.sent} 个
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        未发送
                      </Text>
                      <Text size="xs" fw={500} c="orange">
                        {stats.unsent} 个
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        发送率
                      </Text>
                      <Text size="xs" fw={500}>
                        {stats.sentRate}%
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Paper>
        )}
      </Stack>
    </Modal>
  );
}
