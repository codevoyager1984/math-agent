import React from 'react';
import { Card, Group, Text } from '@mantine/core';
import { IconBook, IconMathFunction } from '@tabler/icons-react';

interface KnowledgeBaseStatsProps {
  collectionInfo?: {
    count: number;
    name: string;
  } | null;
}

export default function KnowledgeBaseStats({ collectionInfo }: KnowledgeBaseStatsProps) {
  if (!collectionInfo) return null;

  return (
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
  );
}
