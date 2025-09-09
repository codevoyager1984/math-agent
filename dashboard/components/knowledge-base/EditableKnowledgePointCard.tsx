import React, { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  TextInput,
  Textarea,
  Select,
  Group,
  Button,
  ActionIcon,
  Text,
  Badge,
  Divider,
  Checkbox,
  MultiSelect,
  Paper,
} from '@mantine/core';
import { IconPlus, IconTrash, IconGripVertical } from '@tabler/icons-react';
import { KnowledgePointInput, Example } from '@/api/knowledge';
import { CATEGORY_OPTIONS } from '@/constants/categories';

interface EditableKnowledgePointCardProps {
  knowledgePoint: KnowledgePointInput;
  index: number;
  selected: boolean;
  onUpdate: (index: number, updatedKnowledgePoint: KnowledgePointInput) => void;
  onToggleSelect: (index: number) => void;
  onDelete: (index: number) => void;
}


const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
];

export default function EditableKnowledgePointCard({
  knowledgePoint,
  index,
  selected,
  onUpdate,
  onToggleSelect,
  onDelete,
}: EditableKnowledgePointCardProps) {
  const [localKnowledgePoint, setLocalKnowledgePoint] = useState<KnowledgePointInput>(knowledgePoint);

  // 同步父组件传入的知识点数据
  useEffect(() => {
    setLocalKnowledgePoint(knowledgePoint);
  }, [knowledgePoint]);

  const handleFieldChange = (field: keyof KnowledgePointInput, value: any) => {
    const updated = { ...localKnowledgePoint, [field]: value };
    setLocalKnowledgePoint(updated);
    onUpdate(index, updated);
  };

  const handleExampleChange = (exampleIndex: number, field: keyof Example, value: string) => {
    const updatedExamples = [...localKnowledgePoint.examples];
    updatedExamples[exampleIndex] = {
      ...updatedExamples[exampleIndex],
      [field]: value,
    };
    handleFieldChange('examples', updatedExamples);
  };

  const handleAddExample = () => {
    const newExample: Example = {
      question: '',
      solution: '',
      difficulty: 'medium',
    };
    handleFieldChange('examples', [...localKnowledgePoint.examples, newExample]);
  };

  const handleRemoveExample = (exampleIndex: number) => {
    const updatedExamples = localKnowledgePoint.examples.filter((_, i) => i !== exampleIndex);
    handleFieldChange('examples', updatedExamples);
  };

  const handleTagsChange = (tags: string[]) => {
    handleFieldChange('tags', tags);
  };

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        border: selected ? '2px solid #228be6' : undefined,
        backgroundColor: selected ? '#f8f9fa' : undefined,
      }}
    >
      <Stack gap="md">
        {/* 头部控制区域 */}
        <Group justify="space-between">
          <Group gap="xs">
            <ActionIcon variant="subtle" size="sm">
              <IconGripVertical size={16} />
            </ActionIcon>
            <Checkbox
              checked={selected}
              onChange={() => onToggleSelect(index)}
              size="sm"
            />
            <Badge variant="light" color="blue" size="sm">
              #{index + 1}
            </Badge>
          </Group>
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => onDelete(index)}
            size="sm"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>

        {/* 基本信息编辑 */}
        <Stack gap="sm">
          <TextInput
            label="知识点标题"
            placeholder="输入知识点标题"
            value={localKnowledgePoint.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            required
            size="sm"
          />

          <Textarea
            label="知识点描述"
            placeholder="详细描述该知识点的概念、定义和应用场景"
            value={localKnowledgePoint.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            minRows={3}
            maxRows={6}
            autosize
            required
            size="sm"
          />

          <Group grow>
            <Select
              label="分类"
              placeholder="选择分类"
              data={CATEGORY_OPTIONS}
              value={localKnowledgePoint.category}
              onChange={(value) => handleFieldChange('category', value || 'general')}
              size="sm"
              searchable
            />

            <MultiSelect
              label="标签"
              placeholder="输入标签，按回车添加"
              data={localKnowledgePoint.tags || []}
              value={localKnowledgePoint.tags || []}
              onChange={handleTagsChange}
              searchable
              size="sm"
            />
          </Group>
        </Stack>

        <Divider />

        {/* 例题编辑区域 */}
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              例题 ({localKnowledgePoint.examples.length})
            </Text>
            <Button
              leftSection={<IconPlus size={14} />}
              variant="light"
              size="xs"
              onClick={handleAddExample}
            >
              添加例题
            </Button>
          </Group>

          {localKnowledgePoint.examples.map((example, exampleIndex) => (
            <Paper key={exampleIndex} p="sm" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    例题 {exampleIndex + 1}
                  </Text>
                  <Group gap="xs">
                    <Select
                      data={DIFFICULTY_OPTIONS}
                      value={example.difficulty}
                      onChange={(value) =>
                        handleExampleChange(exampleIndex, 'difficulty', value || 'medium')
                      }
                      size="xs"
                      w={80}
                    />
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      size="xs"
                      onClick={() => handleRemoveExample(exampleIndex)}
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                </Group>

                <TextInput
                  placeholder="例题题目"
                  value={example.question}
                  onChange={(e) =>
                    handleExampleChange(exampleIndex, 'question', e.target.value)
                  }
                  size="xs"
                />

                <Textarea
                  placeholder="详细的解题步骤和答案"
                  value={example.solution}
                  onChange={(e) =>
                    handleExampleChange(exampleIndex, 'solution', e.target.value)
                  }
                  minRows={2}
                  maxRows={4}
                  autosize
                  size="xs"
                />
              </Stack>
            </Paper>
          ))}

          {localKnowledgePoint.examples.length === 0 && (
            <Paper p="lg" c="dimmed" ta="center" style={{ border: '2px dashed #e9ecef' }}>
              <Text size="sm">暂无例题，点击"添加例题"按钮开始添加</Text>
            </Paper>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}