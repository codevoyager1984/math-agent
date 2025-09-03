import React from 'react';
import {
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconReport,
  IconCheck,
  IconX,
  IconUser,
} from '@tabler/icons-react';
import { ReportStats } from '@/api/report';

interface ReportStatsGridProps {
  stats: ReportStats | null;
  loading: boolean;
}

export default function ReportStatsGrid({ stats, loading }: ReportStatsGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
      <Paper p="md" shadow="sm" radius="md" h="120">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              总报告数
            </Text>
            <IconReport size={20} color="blue" />
          </Group>
          <Text size="xl" fw={700}>
            {loading ? '-' : (stats?.total_reports || 0).toLocaleString()}
          </Text>
          <Badge color="blue" size="sm">
            报告统计
          </Badge>
        </Stack>
      </Paper>

      <Paper p="md" shadow="sm" radius="md" h="120">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              已发布报告
            </Text>
            <IconCheck size={20} color="green" />
          </Group>
          <Text size="xl" fw={700}>
            {loading ? '-' : (stats?.published_reports || 0).toLocaleString()}
          </Text>
          <Badge color="green" size="sm">
            发布统计
          </Badge>
        </Stack>
      </Paper>

      <Paper p="md" shadow="sm" radius="md" h="120">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              错误报告数
            </Text>
            <IconX size={20} color="red" />
          </Group>
          <Text size="xl" fw={700}>
            {loading ? '-' : (stats?.error_reports || 0).toLocaleString()}
          </Text>
          <Badge color="red" size="sm">
            错误统计
          </Badge>
        </Stack>
      </Paper>

      <Paper p="md" shadow="sm" radius="md" h="120">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              活跃用户数
            </Text>
            <IconUser size={20} color="purple" />
          </Group>
          <Text size="xl" fw={700}>
            {loading ? '-' : (stats?.active_users || 0).toLocaleString()}
          </Text>
          <Badge color="purple" size="sm">
            用户统计
          </Badge>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
} 