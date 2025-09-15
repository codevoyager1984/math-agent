import React, { useState } from 'react';
import {
  Card,
  Stack,
  Group,
  TextInput,
  Select,
  Button,
  Slider,
  Switch,
  Collapse,
  Text,
  NumberInput,
  Divider
} from '@mantine/core';
import { IconSearch, IconSettings, IconChevronDown, IconChevronUp, IconRefresh, IconRestore } from '@tabler/icons-react';
import { getCategoryOptionsWithAll } from '@/constants/categories';
import { isConfigDifferentFromDefault, type SearchConfig } from '@/utils/searchConfig';

interface SearchFiltersProps {
  search: string;
  categoryFilter: string;
  searchMode: 'vector' | 'text' | 'hybrid';
  vectorWeight: number;
  textWeight: number;
  enableRerank: boolean;
  rerankMethod: 'cross_encoder' | 'llm';
  rerankTopK?: number;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSearchModeChange: (value: 'vector' | 'text' | 'hybrid') => void;
  onVectorWeightChange: (value: number) => void;
  onTextWeightChange: (value: number) => void;
  onEnableRerankChange: (value: boolean) => void;
  onRerankMethodChange: (value: 'cross_encoder' | 'llm') => void;
  onRerankTopKChange: (value: number | undefined) => void;
  onSearch: () => void;
  onReset: () => void;
  onResetConfig: () => void;
}

export default function SearchFilters({
  search,
  categoryFilter,
  searchMode,
  vectorWeight,
  textWeight,
  enableRerank,
  rerankMethod,
  rerankTopK,
  onSearchChange,
  onCategoryChange,
  onSearchModeChange,
  onVectorWeightChange,
  onTextWeightChange,
  onEnableRerankChange,
  onRerankMethodChange,
  onRerankTopKChange,
  onSearch,
  onReset,
  onResetConfig,
}: SearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 检查当前配置是否与默认配置不同
  const currentConfig: SearchConfig = {
    searchMode,
    vectorWeight,
    textWeight,
    enableRerank,
    rerankMethod,
    rerankTopK,
  };
  const isCustomConfig = isConfigDifferentFromDefault(currentConfig);

  // 搜索模式选项
  const searchModeOptions = [
    { value: 'vector', label: '向量搜索' },
    { value: 'text', label: '文本搜索' },
    { value: 'hybrid', label: '混合搜索' },
  ];

  // 重排序方法选项
  const rerankMethodOptions = [
    { value: 'cross_encoder', label: '传统模型 (Cross-Encoder)' },
    { value: 'llm', label: '大语言模型 (LLM)' },
  ];

  // 权重变化时自动调整另一个权重
  const handleVectorWeightChange = (value: number) => {
    onVectorWeightChange(value);
    onTextWeightChange(1 - value);
  };

  const handleTextWeightChange = (value: number) => {
    onTextWeightChange(value);
    onVectorWeightChange(1 - value);
  };

  return (
    <Card withBorder p="md">
      <Stack gap="md">
        {/* 基本搜索控件 */}
        <Group align="flex-end" gap="md">
          <TextInput
            label="搜索"
            placeholder="搜索知识点名称、描述或标签"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1, minWidth: 200 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSearch();
              }
            }}
          />
          <Select
            label="分类"
            placeholder="选择分类"
            value={categoryFilter}
            onChange={(value) => onCategoryChange(value || 'all')}
            data={getCategoryOptionsWithAll()}
            style={{ minWidth: 120 }}
          />
          <Select
            label="搜索模式"
            placeholder="选择搜索模式"
            value={searchMode}
            onChange={(value) => onSearchModeChange(value as 'vector' | 'text' | 'hybrid')}
            data={searchModeOptions}
            style={{ minWidth: 120 }}
          />
        </Group>

        {/* 搜索按钮组 */}
        <Group justify="space-between">
          <Group gap="sm">
            <Button onClick={onSearch} leftSection={<IconSearch size={16} />}>
              搜索
            </Button>
            <Button variant="light" onClick={onReset}>
              重置搜索
            </Button>
            {isCustomConfig && (
              <Button
                variant="outline"
                color="gray"
                onClick={onResetConfig}
                leftSection={<IconRestore size={16} />}
                title="恢复默认搜索配置"
              >
                恢复默认
              </Button>
            )}
          </Group>

          {/* 高级选项切换 */}
          <Button
            variant="subtle"
            size="sm"
            leftSection={<IconSettings size={16} />}
            rightSection={showAdvanced ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            高级选项
          </Button>
        </Group>

        {/* 高级搜索选项 */}
        <Collapse in={showAdvanced}>
          <Card withBorder variant="light" p="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500} c="dimmed">
                  高级搜索配置
                </Text>
                {isCustomConfig && (
                  <Group gap="xs">
                    <Text size="xs" c="blue">
                      ● 已自定义
                    </Text>
                  </Group>
                )}
              </Group>

              {/* 混合搜索权重控制 */}
              {searchMode === 'hybrid' && (
                <>
                  <Divider label="权重配置" />
                  <Group grow>
                    <Stack gap="xs">
                      <Text size="sm">向量搜索权重: {(vectorWeight * 100).toFixed(0)}%</Text>
                      <Slider
                        value={vectorWeight}
                        onChange={handleVectorWeightChange}
                        min={0}
                        max={1}
                        step={0.1}
                        marks={[
                          { value: 0, label: '0%' },
                          { value: 0.5, label: '50%' },
                          { value: 1, label: '100%' },
                        ]}
                        color="blue"
                      />
                    </Stack>
                    <Stack gap="xs">
                      <Text size="sm">文本搜索权重: {(textWeight * 100).toFixed(0)}%</Text>
                      <Slider
                        value={textWeight}
                        onChange={handleTextWeightChange}
                        min={0}
                        max={1}
                        step={0.1}
                        marks={[
                          { value: 0, label: '0%' },
                          { value: 0.5, label: '50%' },
                          { value: 1, label: '100%' },
                        ]}
                        color="green"
                      />
                    </Stack>
                  </Group>
                </>
              )}

              {/* 重排序配置 */}
              <Divider label="重排序配置" />
              <Stack gap="md">
                <Switch
                  label="启用智能重排序"
                  description="使用AI模型对搜索结果进行重排序以提高相关性"
                  checked={enableRerank}
                  onChange={(event) => onEnableRerankChange(event.currentTarget.checked)}
                />

                {enableRerank && (
                  <Group grow>
                    <Select
                      label="重排序方法"
                      description="选择重排序使用的AI模型"
                      value={rerankMethod}
                      onChange={(value) => onRerankMethodChange(value as 'cross_encoder' | 'llm')}
                      data={rerankMethodOptions}
                    />
                    
                    <NumberInput
                      label="重排序结果数量"
                      description="重排序后返回的最大结果数量"
                      value={rerankTopK || ''}
                      onChange={(value) => onRerankTopKChange(typeof value === 'number' ? value : undefined)}
                      min={1}
                      max={50}
                      placeholder="默认使用搜索结果数量"
                    />
                  </Group>
                )}
              </Stack>

              {/* 搜索模式说明 */}
              <Divider label="搜索模式说明" />
              <Stack gap="xs">
                <Group gap="xs">
                  <Text size="sm" fw={500}>向量搜索:</Text>
                  <Text size="sm" c="dimmed">基于语义相似度的智能搜索，理解查询意图</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" fw={500}>文本搜索:</Text>
                  <Text size="sm" c="dimmed">基于关键词匹配的传统全文搜索</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" fw={500}>混合搜索:</Text>
                  <Text size="sm" c="dimmed">结合向量和文本搜索，提供最佳搜索体验</Text>
                </Group>
              </Stack>

              {/* 重排序方法说明 */}
              <Divider label="重排序方法说明" />
              <Stack gap="xs">
                <Group gap="xs">
                  <Text size="sm" fw={500}>传统模型:</Text>
                  <Text size="sm" c="dimmed">使用Cross-Encoder模型，速度快，适合一般场景</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" fw={500}>大语言模型:</Text>
                  <Text size="sm" c="dimmed">使用LLM进行智能重排序，理解力强，自动过滤不相关结果</Text>
                </Group>
              </Stack>
            </Stack>
          </Card>
        </Collapse>
      </Stack>
    </Card>
  );
}
