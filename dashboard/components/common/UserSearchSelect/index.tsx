'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Select } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconMail, IconRefresh } from '@tabler/icons-react';
import { searchUsersByEmail } from '@/api/invite';

interface UserSearchSelectProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string | null) => void;
  error?: React.ReactNode;
  disabled?: boolean;
  clearable?: boolean;
  required?: boolean;
  style?: React.CSSProperties;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

interface UserOption {
  id: string;
  email: string;
}

export default function UserSearchSelect({
  label = '搜索用户',
  placeholder = '输入用户邮箱搜索...',
  value,
  onChange,
  error,
  disabled = false,
  clearable = true,
  required = false,
  style,
  size = 'sm',
}: UserSearchSelectProps) {
  const [userEmailSearch, setUserEmailSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // 防抖搜索
  const [debouncedEmailSearch] = useDebouncedValue(userEmailSearch, 500);

  // 搜索用户
  const searchUsers = async (email: string) => {
    if (!email.trim()) {
      setUserSearchResults([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const response = await searchUsersByEmail(email.trim());
      setUserSearchResults(response.users);
    } catch (error) {
      console.error('搜索用户失败:', error);
      setUserSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  // 防抖搜索用户
  useEffect(() => {
    searchUsers(debouncedEmailSearch);
  }, [debouncedEmailSearch]);

  // 生成用户选项数据
  const userOptions = useMemo(() => {
    return userSearchResults.map((user) => ({
      value: user.id,
      label: user.email,
    }));
  }, [userSearchResults]);

  return (
    <Select
      label={label}
      placeholder={placeholder}
      leftSection={<IconMail size={16} />}
      searchable
      searchValue={userEmailSearch}
      onSearchChange={setUserEmailSearch}
      value={value}
      onChange={onChange}
      data={userOptions}
      clearable={clearable}
      required={required}
      error={error}
      disabled={disabled}
      size={size}
      style={style}
      nothingFoundMessage={
        userEmailSearch
          ? searchingUsers
            ? '搜索中...'
            : '未找到匹配用户'
          : '输入邮箱搜索用户'
      }
      rightSection={searchingUsers ? <IconRefresh size={16} /> : undefined}
      maxDropdownHeight={200}
    />
  );
} 