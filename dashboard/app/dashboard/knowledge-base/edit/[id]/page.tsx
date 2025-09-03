'use client';

import React, { useState, useEffect } from 'react';
import {
  Container,
  Stack,
  Group,
  Button,
  TextInput,
  Select,
  ActionIcon,
  Card,
  Text,
  Textarea,
  Divider,
  LoadingOverlay,
} from '@mantine/core';
import { IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader/PageHeader';
import { updateKnowledgePoint, getKnowledgePoint, KnowledgePointInput, Example, KnowledgePoint } from '@/api/knowledge';

export default function EditKnowledgePointPage() {
  const router = useRouter();
  const params = useParams();
  const knowledgePointId = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [knowledgePoint, setKnowledgePoint] = useState<KnowledgePoint | null>(null);
  
  const [form, setForm] = useState<KnowledgePointInput>({
    title: '',
    description: '',
    category: 'sequence',
    examples: [],
    tags: []
  });

  // 加载知识点数据
  useEffect(() => {
    if (knowledgePointId) {
      loadKnowledgePoint();
    }
  }, [knowledgePointId]);

  const loadKnowledgePoint = async () => {
    try {
      setLoading(true);
      const data = await getKnowledgePoint(knowledgePointId);
      setKnowledgePoint(data);
      setForm({
        title: data.title,
        description: data.description,
        category: data.category,
        examples: data.examples || [],
        tags: data.tags || []
      });
    } catch (error) {
      console.error('加载知识点失败:', error);
      toast.error('加载知识点失败');
      router.push('/dashboard/knowledge-base');
    } finally {
      setLoading(false);
    }
  };

  // 添加例题
  const addExample = () => {
    setForm(prev => ({
      ...prev,
      examples: [
        ...prev.examples,
        { question: '', solution: '', difficulty: 'medium' as const }
      ]
    }));
  };

  // 删除例题
  const removeExample = (index: number) => {
    setForm(prev => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index)
    }));
  };

  // 更新例题
  const updateExample = (index: number, field: keyof Example, value: string) => {
    setForm(prev => ({
      ...prev,
      examples: prev.examples.map((ex, i) => 
        i === index ? { ...ex, [field]: value } : ex
      )
    }));
  };

  // 处理标签输入
  const handleTagsChange = (value: string) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    setForm(prev => ({
      ...prev,
      tags
    }));
  };

  // 保存知识点
  const handleSave = async () => {
    try {
      if (!form.title.trim()) {
        toast.error('请输入知识点名称');
        return;
      }
      if (!form.description.trim()) {
        toast.error('请输入知识点内容');
        return;
      }

      setSaving(true);
      await updateKnowledgePoint(knowledgePointId, form);
      toast.success('知识点更新成功');
      router.push('/dashboard/knowledge-base');
    } catch (error) {
      console.error('更新知识点失败:', error);
      toast.error('更新知识点失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container fluid size="xl">
        <LoadingOverlay visible overlayProps={{ radius: "sm", blur: 2 }} />
        <div style={{ height: '400px' }} />
      </Container>
    );
  }

  if (!knowledgePoint) {
    return (
      <Container fluid size="xl">
        <Stack gap="md">
          <Group gap="sm" align="center">
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => router.back()}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <PageHeader title="知识点不存在" />
          </Group>
          <Text>未找到指定的知识点</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container fluid size="xl">
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ActionIcon
            variant="light"
            size="lg"
            onClick={() => router.back()}
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <PageHeader title="编辑知识点" />
        </Group>

        <Card withBorder p="md">
          <Stack gap="md">
            {/* 基本信息 */}
            <Stack gap="sm">
              <Text size="md" fw={600}>基本信息</Text>
              
              <TextInput
                label="知识点名称"
                placeholder="请输入知识点名称"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                size="sm"
              />
              
              <Textarea
                label="知识点内容"
                placeholder="请输入知识点的详细描述"
                required
                minRows={10}
                maxRows={20}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                autosize
              />
              
              <Group grow>
                <Select
                  label="分类"
                  placeholder="选择分类"
                  value={form.category}
                  onChange={(value) => setForm({ ...form, category: value || 'sequence' })}
                  data={[
                    { value: 'sequence', label: '数列' },
                  ]}
                  size="sm"
                />
                
                <TextInput
                  label="标签"
                  placeholder="请输入标签，用逗号分隔"
                  value={form.tags?.join(', ') || ''}
                  onChange={(e) => handleTagsChange(e.target.value)}
                  description="例如：基础,重要,考试重点"
                  size="sm"
                />
              </Group>
            </Stack>

            <Divider my="xs" />

            {/* 例题部分 */}
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="md" fw={600}>相关例题</Text>
                <Button 
                  variant="light" 
                  leftSection={<IconPlus size={14} />}
                  onClick={addExample}
                  size="sm"
                >
                  添加例题
                </Button>
              </Group>

              {form.examples.length === 0 && (
                <Card withBorder p="sm" bg="gray.0">
                  <Text size="sm" c="dimmed" ta="center">
                    暂无例题，点击上方按钮添加例题
                  </Text>
                </Card>
              )}

              {form.examples.map((example, index) => (
                <Card key={index} withBorder p="sm">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>例题 {index + 1}</Text>
                      <ActionIcon 
                        variant="light" 
                        color="red" 
                        size="sm"
                        onClick={() => removeExample(index)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                    
                    <Textarea
                      label="题目"
                      placeholder="请输入例题题目"
                      value={example.question}
                      onChange={(e) => updateExample(index, 'question', e.target.value)}
                      minRows={4}
                      maxRows={10}
                      autosize
                    />
                    
                    <Textarea
                      label="解答"
                      placeholder="请输入详细的解题步骤"
                      value={example.solution}
                      onChange={(e) => updateExample(index, 'solution', e.target.value)}
                      minRows={6}
                      maxRows={15}
                      autosize
                    />
                    
                    <Select
                      label="难度"
                      value={example.difficulty}
                      onChange={(value) => updateExample(index, 'difficulty', value || 'medium')}
                      data={[
                        { value: 'easy', label: '简单' },
                        { value: 'medium', label: '中等' },
                        { value: 'hard', label: '困难' },
                      ]}
                      size="sm"
                    />
                  </Stack>
                </Card>
              ))}
            </Stack>

            <Divider my="xs" />

            {/* 操作按钮 */}
            <Group justify="flex-end" gap="sm">
              <Button 
                variant="light" 
                onClick={() => router.back()}
                disabled={saving}
                size="sm"
              >
                取消
              </Button>
              <Button 
                onClick={handleSave}
                loading={saving}
                size="sm"
              >
                保存更改
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
