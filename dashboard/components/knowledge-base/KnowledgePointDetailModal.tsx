import React from 'react';
import {
  Modal,
  Stack,
  Group,
  Grid,
  Text,
  Badge,
  Title,
  Card,
  Box,
  Divider,
} from '@mantine/core';
import { IconBulb, IconTag } from '@tabler/icons-react';
import { KnowledgePoint } from '@/api/knowledge';
import { formatTimestamp } from '@/utils';

interface KnowledgePointDetailModalProps {
  opened: boolean;
  onClose: () => void;
  knowledgePoint: KnowledgePoint | null;
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

export default function KnowledgePointDetailModal({
  opened,
  onClose,
  knowledgePoint,
}: KnowledgePointDetailModalProps) {
  const formatDate = (dateString?: string) => {
    return formatTimestamp.dateTime(dateString);
  };

  if (!knowledgePoint) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="知识点详情"
      size="xl"
    >
      <Stack gap="md">
        <Group align="flex-start" gap="md">
          <IconBulb size={40} color="orange" />
          <Stack gap="sm" style={{ flex: 1 }}>
            <Title order={3}>{knowledgePoint.title}</Title>
            <Badge variant="light" color="blue">
              {knowledgePoint.category}
            </Badge>
          </Stack>
        </Group>

        <Grid>
          <Grid.Col span={12}>
            <Text size="sm" c="dimmed">描述</Text>
            <Text>{knowledgePoint.description}</Text>
          </Grid.Col>
          
          {knowledgePoint.tags && knowledgePoint.tags.length > 0 && (
            <Grid.Col span={12}>
              <Text size="sm" c="dimmed">标签</Text>
              <Group gap="xs">
                {knowledgePoint.tags.map((tag, index) => (
                  <Badge key={index} variant="light" leftSection={<IconTag size={12} />}>
                    {tag}
                  </Badge>
                ))}
              </Group>
            </Grid.Col>
          )}

          <Grid.Col span={6}>
            <Text size="sm" c="dimmed">知识点ID</Text>
            <Text style={{ wordBreak: 'break-all' }}>{knowledgePoint.id}</Text>
          </Grid.Col>
          <Grid.Col span={6}>
            <Text size="sm" c="dimmed">例题数量</Text>
            <Text>{knowledgePoint.examples.length} 题</Text>
          </Grid.Col>
          <Grid.Col span={6}>
            <Text size="sm" c="dimmed">创建时间</Text>
            <Text>{formatDate(knowledgePoint.created_at)}</Text>
          </Grid.Col>
          <Grid.Col span={6}>
            <Text size="sm" c="dimmed">更新时间</Text>
            <Text>{formatDate(knowledgePoint.updated_at)}</Text>
          </Grid.Col>
        </Grid>

        {/* 搜索相关信息（仅在搜索结果中显示） */}
        {knowledgePoint.similarity_score !== undefined && knowledgePoint.similarity_score !== null && (
          <>
            <Divider />
            <Box>
              <Text size="sm" fw={500} mb="sm">搜索匹配信息</Text>
              <Card withBorder p="md">
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">匹配度评分</Text>
                  <Badge
                    size="lg"
                    variant="gradient"
                    gradient={
                      knowledgePoint.similarity_score >= 80
                        ? { from: 'green', to: 'teal', deg: 45 }
                        : knowledgePoint.similarity_score >= 60
                        ? { from: 'yellow', to: 'orange', deg: 45 }
                        : { from: 'orange', to: 'red', deg: 45 }
                    }
                  >
                    {knowledgePoint.similarity_score.toFixed(2)}%
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  基于语义相似度和文本匹配计算的综合评分
                </Text>
              </Card>
            </Box>
          </>
        )}

        {knowledgePoint.examples.length > 0 && (
          <>
            <Divider />
            <Box>
              <Text size="sm" fw={500} mb="sm">相关例题</Text>
              <Stack gap="md">
                {knowledgePoint.examples.map((example, index) => (
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
    </Modal>
  );
}
