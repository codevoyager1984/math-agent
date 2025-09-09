import React from 'react';
import { Card, Stack, Group, TextInput, Select, Button } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { getCategoryOptionsWithAll } from '@/constants/categories';

interface SearchFiltersProps {
  search: string;
  categoryFilter: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
}

export default function SearchFilters({
  search,
  categoryFilter,
  onSearchChange,
  onCategoryChange,
  onSearch,
  onReset,
}: SearchFiltersProps) {
  return (
    <Card withBorder p="md">
      <Stack gap="md">
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
          <Group gap="sm">
            <Button onClick={onSearch} leftSection={<IconSearch size={16} />}>
              搜索
            </Button>
            <Button variant="light" onClick={onReset}>
              重置
            </Button>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}
