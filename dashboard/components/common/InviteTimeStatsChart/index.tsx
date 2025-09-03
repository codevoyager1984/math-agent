import React, { useEffect, useState } from 'react';
import { Card, Title, Loader, Center, Paper, Group, Text, Stack, SimpleGrid } from '@mantine/core';
import { IconUsers, IconChartLine } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { getInviteTimeStats, InviteTimeStats } from '@/api/invite';
import DateRangeFilter from '@/components/common/DateRangeFilter';

interface InviteTimeStatsChartProps {
  title?: string;
  dateRange: [Date | null, Date | null];
}

const InviteTimeStatsChart: React.FC<InviteTimeStatsChartProps> = ({ 
  title = "邀请统计分析",
  dateRange
}) => {
  const [data, setData] = useState<InviteTimeStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!dateRange[0] || !dateRange[1]) return;
      
      setLoading(true);
      try {
        const stats = await getInviteTimeStats({
          start_date: dayjs(dateRange[0]).format('YYYY-MM-DD'),
          end_date: dayjs(dateRange[1]).format('YYYY-MM-DD'),
        });
        if (!cancelled) setData(stats);
      } catch (error) {
        console.error('获取邀请统计失败:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    fetchData();
    return () => { cancelled = true; };
  }, [dateRange]);

  return (
    <Paper p="md" shadow="sm" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={5}>{title}</Title>
        </Group>
        
        {/* 时间筛选器已移到页面级别 */}

        {loading ? (
          <Center h={120}>
            <Loader size="sm" />
          </Center>
        ) : data ? (
          <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md">
            {/* 创建了邀请码的用户数 */}
            <Card p="sm" shadow="sm" radius="md" h={80}>
              <Group justify="space-between" align="center" h="100%">
                <Stack gap={2} flex={1}>
                  <Text size="xs" c="dimmed">创建邀请码</Text>
                  <Text size="lg" fw={700} c="teal">
                    {data.total_users_created_codes}
                  </Text>
                  <Text size="xs" c="dimmed">用户数</Text>
                </Stack>
                <IconUsers size={16} color="teal" />
              </Group>
            </Card>

            {/* 成功邀请了用户的用户数 */}
            <Card p="sm" shadow="sm" radius="md" h={80}>
              <Group justify="space-between" align="center" h="100%">
                <Stack gap={2} flex={1}>
                  <Text size="xs" c="dimmed">成功邀请</Text>
                  <Text size="lg" fw={700} c="blue">
                    {data.total_users_with_invites}
                  </Text>
                  <Text size="xs" c="dimmed">用户数</Text>
                </Stack>
                <IconUsers size={16} color="blue" />
              </Group>
            </Card>

            {/* 非管理员创建的邀请码总数 */}
            <Card p="sm" shadow="sm" radius="md" h={80}>
              <Group justify="space-between" align="center" h="100%">
                <Stack gap={2} flex={1}>
                  <Text size="xs" c="dimmed">邀请码总数</Text>
                  <Text size="lg" fw={700} c="purple">
                    {data.total_codes_created}
                  </Text>
                  <Text size="xs" c="dimmed">非管理员创建</Text>
                </Stack>
                <IconUsers size={16} color="purple" />
              </Group>
            </Card>

            {/* 通过非管理员邀请码邀请的用户数 */}
            <Card p="sm" shadow="sm" radius="md" h={80}>
              <Group justify="space-between" align="center" h="100%">
                <Stack gap={2} flex={1}>
                  <Text size="xs" c="dimmed">邀请用户数</Text>
                  <Text size="lg" fw={700} c="orange">
                    {data.total_users_invited}
                  </Text>
                  <Text size="xs" c="dimmed">非管理员邀请</Text>
                </Stack>
                <IconUsers size={16} color="orange" />
              </Group>
            </Card>

            {/* 平均邀请数 */}
            <Card p="sm" shadow="sm" radius="md" h={80}>
              <Group justify="space-between" align="center" h="100%">
                <Stack gap={2} flex={1}>
                  <Text size="xs" c="dimmed">平均邀请数</Text>
                  <Text size="lg" fw={700} c="green">
                    {data.average_invites_per_user.toFixed(1)}
                  </Text>
                  <Text size="xs" c="dimmed">人/成功用户</Text>
                </Stack>
                <IconChartLine size={16} color="green" />
              </Group>
            </Card>
          </SimpleGrid>
        ) : (
          <Center h={120}>
            <Text size="sm" c="dimmed">暂无数据</Text>
          </Center>
        )}
      </Stack>
    </Paper>
  );
};

export default InviteTimeStatsChart;
