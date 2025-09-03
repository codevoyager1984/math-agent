import React, { useState, useEffect } from 'react';
import { Stack, Text, Badge, ActionIcon, Group, Alert } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconEye, IconAlertCircle, IconUsers } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { getInvitedUsers, InvitedUser, InvitedUsersResponse } from '../../../api/invite';
import { formatUtcToLocal } from '@/utils';

interface UserInvitedUsersTabProps {
  userId: string;
}

const PAGE_SIZE = 20;

export default function UserInvitedUsersTab({ userId }: UserInvitedUsersTabProps) {
  const router = useRouter();
  const [data, setData] = useState<InvitedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchData = async (currentPage: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await getInvitedUsers(userId, {
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      
      setData(result.users);
      setTotal(result.total);
      setPage(result.page);
    } catch (err: any) {
      setError(err.message || '获取邀请用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchData(1);
    }
  }, [userId]);

  const handlePageChange = (newPage: number) => {
    fetchData(newPage);
  };

  const handleViewUser = (targetUserId: string) => {
    router.push(`/dashboard/users/${targetUserId}`);
  };

  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="加载失败"
        color="red"
        variant="light"
      >
        {error}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Group>
        <IconUsers size={20} />
        <Text size="lg" fw={600}>邀请用户列表</Text>
        <Badge variant="light" color="blue">{total} 位用户</Badge>
      </Group>

      <DataTable
        records={data}
        fetching={loading}
        columns={[
          {
            accessor: 'user_id',
            title: '用户ID',
            width: 400,
            render: (record) => (
              <Text size="sm" style={{ fontFamily: 'monospace' }}>
                {record.user_id}
              </Text>
            ),
          },
          // {
          //   accessor: 'user_email',
          //   title: '邮箱',
          //   render: (record) => (
          //     <Text size="sm" fw={500}>
          //       {record.user_email || '未知'}
          //     </Text>
          //   ),
          // },
          {
            accessor: 'invite_code',
            title: '邀请码',
            width: 120,
            render: (record) => (
              <Badge variant="light" color="blue" size="sm">
                {record.invite_code}
              </Badge>
            ),
          },
          {
            accessor: 'bind_at',
            title: '绑定时间',
            width: 180,
            render: (record) => (
              <Text size="sm" c="dimmed">
                {record.bind_at ? formatUtcToLocal(record.bind_at) : '-'}
              </Text>
            ),
          },
          {
            accessor: 'actions',
            title: '操作',
            width: 80,
            render: (record) => (
              <ActionIcon
                size="sm"
                variant="subtle"
                color="blue"
                onClick={() => handleViewUser(record.user_id)}
              >
                <IconEye size={14} />
              </ActionIcon>
            ),
          },
        ]}
        striped
        highlightOnHover
        totalRecords={total}
        recordsPerPage={PAGE_SIZE}
        page={page}
        onPageChange={handlePageChange}
        noRecordsText="该用户暂未邀请任何用户"
        emptyState={
          <Stack align="center" gap="sm" py={40}>
            <IconUsers size={48} color="gray" />
            <Text size="sm" c="dimmed">该用户暂未邀请任何用户</Text>
          </Stack>
        }
        minHeight={200}
      />
    </Stack>
  );
}; 