import React from 'react';
import { Card, Group, Stack, Text, Badge, ActionIcon } from '@mantine/core';
import { IconEye, IconTrash, IconBulb, IconTag, IconEdit } from '@tabler/icons-react';
import { KnowledgePoint } from '@/api/knowledge';
import { formatTimestamp } from '@/utils';

interface KnowledgePointCardProps {
  knowledgePoint: KnowledgePoint;
  onView: (knowledgePoint: KnowledgePoint) => void;
  onEdit: (id: string) => void;
  onDelete: (knowledgePoint: KnowledgePoint) => void;
}

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

const categoryLabels = {
  sequence: '数列',
  general: '通用',
};

export default function KnowledgePointCard({ knowledgePoint, onView, onEdit, onDelete }: KnowledgePointCardProps) {
  const formatDate = (dateString?: string) => {
    return formatTimestamp.dateTime(dateString);
  };

  return (
    <Card withBorder p="md" h="100%">
      <Stack gap="sm" h="100%">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="sm" align="flex-start" style={{ flex: 1 }}>
            <IconBulb size={20} color="orange" style={{ marginTop: 2 }} />
            <Stack gap={4} style={{ flex: 1 }}>
              <Text size="md" fw={600} lineClamp={2}>
                {knowledgePoint.title}
              </Text>
              <Text size="xs" c="dimmed">
                ID: {knowledgePoint.id.slice(0, 8)}...
              </Text>
            </Stack>
          </Group>
          <Group gap="xs">
            <ActionIcon
              variant="light"
              color="blue"
              size="sm"
              onClick={() => onView(knowledgePoint)}
              title="查看详情"
            >
              <IconEye size={14} />
            </ActionIcon>
            <ActionIcon
              variant="light"
              color="orange"
              size="sm"
              onClick={() => onEdit(knowledgePoint.id)}
              title="编辑"
            >
              <IconEdit size={14} />
            </ActionIcon>
            <ActionIcon
              variant="light"
              color="red"
              size="sm"
              onClick={() => onDelete(knowledgePoint)}
              title="删除"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Category and Similarity */}
        <Group gap="xs">
          <Badge variant="light" color="blue" size="sm">
            {categoryLabels[knowledgePoint.category as keyof typeof categoryLabels] || knowledgePoint.category}
          </Badge>
          <Badge variant="outline" color="green" size="sm">
            {knowledgePoint.examples.length} 题
          </Badge>
          {/* 显示相似度分数（仅在搜索时显示） */}
          {knowledgePoint.similarity_score !== undefined && knowledgePoint.similarity_score !== null && (
            <Badge 
              variant="gradient" 
              gradient={{ from: 'orange', to: 'red', deg: 45 }}
              size="sm"
            >
              相似度 {knowledgePoint.similarity_score.toFixed(1)}%
            </Badge>
          )}
        </Group>

        {/* Description */}
        <Text size="sm" c="dimmed" lineClamp={3} style={{ flex: 1 }}>
          {knowledgePoint.description}
        </Text>

        {/* Tags */}
        {knowledgePoint.tags && knowledgePoint.tags.length > 0 && (
          <Group gap="xs">
            <IconTag size={14} color="gray" />
            {knowledgePoint.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} size="xs" variant="light" color="gray">
                {tag}
              </Badge>
            ))}
            {knowledgePoint.tags.length > 3 && (
              <Text size="xs" c="dimmed">+{knowledgePoint.tags.length - 3}</Text>
            )}
          </Group>
        )}

        {/* Footer */}
        <Text size="xs" c="dimmed">
          创建于 {formatDate(knowledgePoint.created_at)}
        </Text>
      </Stack>
    </Card>
  );
}
