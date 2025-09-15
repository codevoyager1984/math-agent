import React, { useState, useCallback } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  ScrollArea,
  Badge,
  Divider,
  Alert,
  Progress,
  LoadingOverlay,
  Select,
  MultiSelect,
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconSelectAll,
  IconSelect,
  IconEdit,
  IconTag,
  IconCategory,
  IconInfoCircle,
  IconUpload,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { DocumentInput, batchAddKnowledgePoints, BatchKnowledgePointsResponse } from '@/api/knowledge';
import { CATEGORY_OPTIONS } from '@/constants/categories';
import EditableKnowledgePointCard from './EditableKnowledgePointCard';

interface KnowledgePointPreviewProps {
  opened: boolean;
  onClose: () => void;
  filename: string;
  extractedText: string;
  knowledgePoints: DocumentInput[];
  onSuccess: () => void;
}


export default function KnowledgePointPreview({
  opened,
  onClose,
  filename,
  extractedText,
  knowledgePoints: initialKnowledgePoints,
  onSuccess,
}: KnowledgePointPreviewProps) {
  const [knowledgePoints, setKnowledgePoints] = useState<DocumentInput[]>(initialKnowledgePoints);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(initialKnowledgePoints.map((_, i) => i))
  );
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showExtractedText, setShowExtractedText] = useState(false);

  // 批量操作状态
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  
  // 预定义的标签选项，用户也可以输入新的
  const [tagOptions, setTagOptions] = useState<string[]>([
    '基础', '重要', '难点', '公式', '定理', '应用'
  ]);

  const handleToggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIndices(new Set(knowledgePoints.map((_, i) => i)));
  }, [knowledgePoints.length]);

  const handleSelectNone = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleUpdateKnowledgePoint = useCallback((index: number, updated: DocumentInput) => {
    setKnowledgePoints((prev) => {
      const newPoints = [...prev];
      newPoints[index] = updated;
      return newPoints;
    });
  }, []);

  const handleDeleteKnowledgePoint = useCallback((index: number) => {
    setKnowledgePoints((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      // 更新其他索引
      const updatedSet = new Set<number>();
      newSet.forEach((i) => {
        if (i < index) {
          updatedSet.add(i);
        } else if (i > index) {
          updatedSet.add(i - 1);
        }
      });
      return updatedSet;
    });
  }, []);

  // 批量应用分类
  const handleApplyBulkCategory = useCallback(() => {
    if (!bulkCategory) {
      toast.error('请先选择要设置的分类');
      return;
    }
    
    if (selectedIndices.size === 0) {
      toast.error('请先选择要设置分类的知识点');
      return;
    }
    
    const selectedKnowledgePoints = Array.from(selectedIndices);
    console.log('Selected indices:', selectedKnowledgePoints);
    console.log('Bulk category:', bulkCategory);
    console.log('Knowledge points length:', knowledgePoints.length);
    
    selectedKnowledgePoints.forEach((index) => {
      if (index < knowledgePoints.length) {
        const currentKp = knowledgePoints[index];
        console.log(`Updating knowledge point ${index}:`, currentKp);
        handleUpdateKnowledgePoint(index, {
          ...currentKp,
          category: bulkCategory,
        });
      }
    });
    setBulkCategory('');
    toast.success(`已为 ${selectedKnowledgePoints.length} 个知识点设置分类为：${CATEGORY_OPTIONS.find(opt => opt.value === bulkCategory)?.label || bulkCategory}`);
  }, [bulkCategory, selectedIndices, knowledgePoints, handleUpdateKnowledgePoint]);

  // 批量应用标签
  const handleApplyBulkTags = useCallback(() => {
    if (bulkTags.length === 0) return;
    
    const selectedKnowledgePoints = Array.from(selectedIndices);
    selectedKnowledgePoints.forEach((index) => {
      if (index < knowledgePoints.length) {
        const existingTags = knowledgePoints[index].tags || [];
        const newTags = Array.from(new Set([...existingTags, ...bulkTags]));
        handleUpdateKnowledgePoint(index, {
          ...knowledgePoints[index],
          tags: newTags,
        });
      }
    });
    setBulkTags([]);
    toast.success(`已为 ${selectedKnowledgePoints.length} 个知识点添加标签`);
  }, [bulkTags, selectedIndices, knowledgePoints, handleUpdateKnowledgePoint]);

  const handleImport = async () => {
    try {
      const selectedKnowledgePoints = Array.from(selectedIndices)
        .map((index) => knowledgePoints[index])
        .filter(Boolean);

      if (selectedKnowledgePoints.length === 0) {
        toast.error('请至少选择一个知识点');
        return;
      }

      // 验证必填字段
      const invalidPoints = selectedKnowledgePoints.filter(
        (kp) => !kp.title.trim() || !kp.description.trim()
      );

      if (invalidPoints.length > 0) {
        toast.error('请确保所有选中的知识点都有标题和描述');
        return;
      }

      setImporting(true);
      setImportProgress(0);

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response: BatchKnowledgePointsResponse = await batchAddKnowledgePoints(selectedKnowledgePoints);
      
      clearInterval(progressInterval);
      setImportProgress(100);

      if (response.success_count > 0) {
        toast.success(`成功导入 ${response.success_count} 个知识点！`);
        onSuccess();
        onClose();
      }

      if (response.failed_count > 0) {
        console.error('导入失败的知识点:', response.errors);
        toast.warning(`${response.failed_count} 个知识点导入失败`);
      }

    } catch (error) {
      console.error('批量导入知识点失败:', error);
      toast.error('批量导入知识点失败');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const selectedCount = selectedIndices.size;
  const totalCount = knowledgePoints.length;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconEdit size={20} />
          <Text fw={600}>知识点预览与编辑</Text>
          <Badge variant="light" color="blue">
            {filename}
          </Badge>
        </Group>
      }
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="md">
        {/* 导入进度 */}
        {importing && (
          <Alert icon={<IconUpload size={16} />} color="blue">
            <Stack gap="xs">
              <Text size="sm">正在导入知识点到向量数据库...</Text>
              <Progress value={importProgress} size="sm" />
            </Stack>
          </Alert>
        )}

        {/* 文档信息 */}
        <Group justify="space-between">
          <Group gap="sm">
            <Text size="sm" c="dimmed">
              从文档提取了 {totalCount} 个知识点
            </Text>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => setShowExtractedText(!showExtractedText)}
            >
              {showExtractedText ? '隐藏' : '查看'}提取文本
            </Button>
          </Group>
          <Badge variant="light" color={selectedCount === totalCount ? 'green' : 'blue'}>
            已选择 {selectedCount}/{totalCount}
          </Badge>
        </Group>

        {/* 提取文本预览 */}
        {showExtractedText && (
          <Alert icon={<IconInfoCircle size={16} />} color="gray">
            <Stack gap="xs">
              <Text size="sm" fw={500}>提取的文本内容：</Text>
              <ScrollArea>
                <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                  {extractedText}
                </Text>
              </ScrollArea>
            </Stack>
          </Alert>
        )}

        {/* 批量操作控制 */}
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm">
            <Button
              leftSection={<IconSelectAll size={14} />}
              variant="light"
              size="xs"
              onClick={handleSelectAll}
            >
              全选
            </Button>
            <Button
              leftSection={<IconSelect size={14} />}
              variant="light"
              size="xs"
              onClick={handleSelectNone}
            >
              全不选
            </Button>
          </Group>

          <Group gap="sm">
            <Select
              placeholder="批量设置分类"
              data={CATEGORY_OPTIONS}
              value={bulkCategory}
              onChange={(value) => setBulkCategory(value || '')}
              size="xs"
              w={120}
              leftSection={<IconCategory size={14} />}
            />
            <Button
              size="xs"
              variant="light"
              onClick={handleApplyBulkCategory}
              disabled={!bulkCategory || selectedCount === 0}
            >
              应用
            </Button>

            <MultiSelect
              placeholder="输入标签"
              data={tagOptions}
              value={bulkTags}
              onChange={(values) => {
                setBulkTags(values);
                // 将新输入的标签添加到选项中
                const newTags = values.filter(tag => !tagOptions.includes(tag));
                if (newTags.length > 0) {
                  setTagOptions(prev => [...prev, ...newTags]);
                }
              }}
              searchable
              size="xs"
              w={150}
              leftSection={<IconTag size={14} />}
            />
            <Button
              size="xs"
              variant="light"
              onClick={handleApplyBulkTags}
              disabled={bulkTags.length === 0 || selectedCount === 0}
            >
              应用
            </Button>
          </Group>
        </Group>

        <Divider />

        {/* 知识点列表 */}
        <div style={{ position: 'relative' }}>
          <LoadingOverlay visible={importing} />
          
          <ScrollArea h={600}>
            <Stack gap="md">
              {knowledgePoints.map((kp, index) => (
                <EditableKnowledgePointCard
                  key={`${filename}-${index}`}
                  knowledgePoint={kp}
                  index={index}
                  selected={selectedIndices.has(index)}
                  onUpdate={handleUpdateKnowledgePoint}
                  onToggleSelect={handleToggleSelect}
                  onDelete={handleDeleteKnowledgePoint}
                />
              ))}
            </Stack>
          </ScrollArea>
        </div>

        {/* 操作按钮 */}
        <Group justify="space-between" mt="md">
          <Button
            variant="subtle"
            leftSection={<IconX size={16} />}
            onClick={onClose}
            disabled={importing}
          >
            取消
          </Button>

          <Group gap="sm">
            <Text size="sm" c="dimmed">
              将导入 {selectedCount} 个知识点
            </Text>
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
              loading={importing}
            >
              确认导入
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}