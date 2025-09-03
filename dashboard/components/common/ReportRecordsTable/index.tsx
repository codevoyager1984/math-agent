import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { DataTable } from 'mantine-datatable';
import { toast } from 'sonner';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconCode,
  IconCopy,
  IconEye,
  IconRefresh,
  IconExternalLink,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconWorld,
} from '@tabler/icons-react';
import { ReportListItem, ReportDetail } from '@/api/report';
import { formatTimestamp } from '@/utils';

// 格式化Token数量的工具函数
const formatTokenCount = (count: number): string => {
  if (count < 1000) {
    return count.toString();
  } else if (count < 1000000) {
    return (count / 1000).toFixed(1) + 'K';
  } else if (count < 1000000000) {
    return (count / 1000000).toFixed(1) + 'M';
  } else {
    return (count / 1000000000).toFixed(1) + 'B';
  }
};

// 格式化美元金额的工具函数
const formatCurrency = (amount: number): string => {
  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`;
  } else if (amount < 1) {
    return `$${amount.toFixed(3)}`;
  } else {
    return `$${amount.toFixed(2)}`;
  }
};

// 格式化生成时间
const formatGenerationTime = (time?: number): string => {
  if (!time) return '-';
  if (time < 60) return `${time}s`;
  if (time < 3600) return `${(time / 60).toFixed(1)}min`;
  return `${(time / 3600).toFixed(1)}h`;
};

// 复制到剪贴板的辅助函数
const copyToClipboard = async (text: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch (err) {
    toast.error('复制失败');
  }
};

// 渲染状态徽章
const renderStatusBadge = (status?: string) => {
  const colorMap: { [key: string]: string } = {
    finished: 'green',
    processing: 'blue',
    failed: 'red',
    pending: 'yellow',
  };
  return (
    <Badge color={colorMap[status || ''] || 'gray'} variant="light">
      {status || 'unknown'}
    </Badge>
  );
};

// 渲染布尔值徽章
const renderBooleanBadge = (value: boolean, trueLabel: string, falseLabel: string, trueColor: string = 'green', falseColor: string = 'gray') => {
  return (
    <Badge color={value ? trueColor : falseColor} variant={value ? 'filled' : 'light'}>
      {value ? trueLabel : falseLabel}
    </Badge>
  );
};

interface ReportRecordsTableProps {
  data: ReportListItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  // 展开相关
  expandedReportId?: string | null;
  reportDetails?: Record<string, ReportDetail>;
  detailLoading?: string | null;
  onRowExpand?: (reportId: string) => void;
  onFetchDetail?: (reportId: string) => void;
  // 自定义选项
  showUserColumn?: boolean;
  userIdFilter?: string;
}

export default function ReportRecordsTable({
  data,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
  onRefresh,
  expandedReportId,
  reportDetails,
  detailLoading,
  onRowExpand,
  onFetchDetail,
  showUserColumn = true,
  userIdFilter,
}: ReportRecordsTableProps) {
  // 切换行展开状态
  const toggleRowExpansion = (reportId: string) => {
    if (onRowExpand) {
      const newExpandedId = expandedReportId === reportId ? null : reportId;
      onRowExpand(newExpandedId || '');
      // 新增：如果有 onFetchDetail，且是展开新行，主动请求详情
      if (onFetchDetail && newExpandedId && newExpandedId !== expandedReportId && !reportDetails?.[newExpandedId]) {
        onFetchDetail(newExpandedId);
      }
    }
  };

  // 渲染展开的报告详情
  const renderExpandedContent = (report: ReportListItem) => {
    const detail = reportDetails?.[report.id];
    const isLoading = detailLoading === report.id;

    if (isLoading) {
      return (
        <Box p="md">
          <Center>
            <Loader size="sm" />
          </Center>
        </Box>
      );
    }

    if (!detail) {
      return null;
    }

    return (
      <Box p="md" bg="gray.0">
        <Stack gap="sm">
          <Title order={5}>报告详情</Title>
          
          {/* 基本信息 */}
          <Card p="sm" radius="sm" withBorder>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={500} size="sm">基本信息</Text>
                <Group gap="xs">
                  {detail.isPublished && <Badge color="green" leftSection={<IconCheck size={12} />}>已发布</Badge>}
                  {detail.publishToWebsite && <Badge color="blue" leftSection={<IconWorld size={12} />}>已发布到网站</Badge>}
                  {detail.comprehensive && <Badge color="purple">全面报告</Badge>}
                  {detail.hasError && <Badge color="red" leftSection={<IconX size={12} />}>有错误</Badge>}
                  {detail.reportedError && <Badge color="orange" leftSection={<IconAlertTriangle size={12} />}>报告错误</Badge>}
                </Group>
              </Group>
              
              <Group gap="lg">
                <Text size="sm"><strong>内容类型:</strong> {detail.contentType}</Text>
                {detail.generationTime && (
                  <Text size="sm"><strong>生成时间:</strong> {formatGenerationTime(detail.generationTime)}</Text>
                )}
                {detail.slug && (
                  <Text size="sm"><strong>Slug:</strong> {detail.slug}</Text>
                )}
              </Group>

              {detail.description && (
                <Box>
                  <Text size="sm" fw={500} mb="xs">描述</Text>
                  <Text size="sm" c="dimmed">{detail.description}</Text>
                </Box>
              )}

              {detail.tags && (
                <Box>
                  <Text size="sm" fw={500} mb="xs">标签</Text>
                  <Group gap="xs">
                    {Array.isArray(detail.tags) ? detail.tags.map((tag, index) => (
                      <Badge key={index} variant="light" size="sm">{tag}</Badge>
                    )) : (
                      <Text size="xs" c="dimmed">无标签</Text>
                    )}
                  </Group>
                </Box>
              )}
            </Stack>
          </Card>

          {/* 问题 */}
          <Card p="sm" radius="sm" withBorder>
            <Group justify="space-between" align="center" mb="xs">
              <Text fw={500} size="sm">问题</Text>
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={() => copyToClipboard(detail.question, '问题已复制到剪贴板')}
                title="复制问题"
              >
                <IconCopy size={12} />
              </ActionIcon>
            </Group>
            <Textarea
              value={detail.question}
              readOnly
              autosize
              minRows={2}
              maxRows={6}
              size="sm"
            />
          </Card>

          {/* Token使用统计 */}
          {detail.token_usage && (
            <Card p="sm" radius="sm" withBorder>
              <Text fw={500} size="sm" mb="xs">Token使用统计</Text>
              <SimpleGrid cols={{ base: 2, sm: 4 }}>
                <Box>
                  <Text size="xs" c="dimmed">总Token</Text>
                  <Text fw={500}>{formatTokenCount(detail.token_usage.total_tokens)}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">输入Token</Text>
                  <Text fw={500} c="blue">{formatTokenCount(detail.token_usage.input_tokens)}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">输出Token</Text>
                  <Text fw={500} c="green">{formatTokenCount(detail.token_usage.output_tokens)}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">估算成本</Text>
                  <Text fw={600} c="orange">{formatCurrency(detail.token_usage.estimated_cost)}</Text>
                </Box>
              </SimpleGrid>
            </Card>
          )}

          {/* HTML预览 */}
          <Card p="sm" radius="sm" withBorder>
            <Group justify="space-between" align="center" mb="xs">
              <Text fw={500} size="sm">HTML内容</Text>
              <Group gap="xs">
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={() => copyToClipboard(detail.html, 'HTML已复制到剪贴板')}
                  title="复制HTML"
                >
                  <IconCopy size={12} />
                </ActionIcon>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={() => {
                    const newWindow = window.open('', '_blank');
                    if (newWindow) {
                      newWindow.document.write(detail.html);
                      newWindow.document.close();
                    }
                  }}
                  title="在新窗口中预览"
                >
                  <IconEye size={12} />
                </ActionIcon>
              </Group>
            </Group>
            <Box
              p="xs"
              bg="#f8f9fa"
              style={{
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                overflow: 'auto',
                maxHeight: '200px',
              }}
            >
              <Text
                style={{
                  whiteSpace: 'pre-wrap',
                  color: '#495057',
                  lineHeight: '1.5',
                  fontSize: '11px',
                }}
              >
                {detail.html}
              </Text>
            </Box>
          </Card>

          {/* 原始LLM响应 */}
          {detail.originalLLMResponse && (
            <Card p="sm" radius="sm" withBorder>
              <Group justify="space-between" align="center" mb="xs">
                <Text fw={500} size="sm">原始LLM响应</Text>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={() => copyToClipboard(detail.originalLLMResponse!, '原始响应已复制到剪贴板')}
                  title="复制原始响应"
                >
                  <IconCopy size={12} />
                </ActionIcon>
              </Group>
              <Textarea
                value={detail.originalLLMResponse}
                readOnly
                autosize
                minRows={3}
                maxRows={8}
                size="sm"
              />
            </Card>
          )}

          {/* React代码 */}
          {detail.originalReactCode && (
            <Card p="sm" radius="sm" withBorder>
              <Group justify="space-between" align="center" mb="xs">
                <Text fw={500} size="sm">React代码</Text>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={() => copyToClipboard(detail.originalReactCode!, 'React代码已复制到剪贴板')}
                  title="复制React代码"
                >
                  <IconCopy size={12} />
                </ActionIcon>
              </Group>
              <Box
                p="xs"
                bg="#f8f9fa"
                style={{
                  border: '1px solid #e9ecef',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                  maxHeight: '300px',
                }}
              >
                <Text
                  style={{
                    whiteSpace: 'pre-wrap',
                    color: '#495057',
                    lineHeight: '1.5',
                    fontSize: '11px',
                  }}
                >
                  {detail.originalReactCode}
                </Text>
              </Box>
            </Card>
          )}
        </Stack>
      </Box>
    );
  };

  // 定义列
  const columns = useMemo(() => {
    const baseColumns = [
      {
        accessor: 'expand',
        title: '',
        width: 50,
        render: (report: ReportListItem) => (
          <ActionIcon variant="light" size="sm" onClick={() => toggleRowExpansion(report.id)}>
            {expandedReportId === report.id ? (
              <IconChevronUp size={16} />
            ) : (
              <IconChevronDown size={16} />
            )}
          </ActionIcon>
        ),
      },
      {
        accessor: 'title',
        title: '报告标题',
        width: 250,
        render: (report: ReportListItem) => (
          <Text fw={500} lineClamp={2}>
            {report.title || `报告 ${report.id.substring(0, 8)}`}
          </Text>
        ),
      },
      {
        accessor: 'question',
        title: '问题',
        width: 300,
        render: (report: ReportListItem) => (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {report.question}
          </Text>
        ),
      },
      {
        accessor: 'status',
        title: '状态',
        width: 100,
        render: (report: ReportListItem) => renderStatusBadge(report.status),
      },
    ];

    // 如果显示用户列且不是用户筛选模式，添加用户列
    if (showUserColumn && !userIdFilter) {
      baseColumns.push({
        accessor: 'userId',
        title: '用户 ID',
        width: 200,
        render: (report: ReportListItem) => (
          <Text size="xs" c="dimmed">
            {report.userId || '-'}
          </Text>
        ),
      });
    }

    const additionalColumns = [
      {
        accessor: 'isPublished',
        title: '已发布',
        width: 80,
        render: (report: ReportListItem) => renderBooleanBadge(report.isPublished, '是', '否'),
      },
      {
        accessor: 'hasError',
        title: '有错误',
        width: 80,
        render: (report: ReportListItem) => renderBooleanBadge(report.hasError || report.reportedError, '是', '否', 'red'),
      },
      {
        accessor: 'token_usage.total_tokens',
        title: '总Token',
        width: 100,
        render: (report: ReportListItem) => {
          const tokenUsage = report.token_usage;
          if (!tokenUsage || tokenUsage.total_tokens === 0) {
            return (
              <Text size="sm" c="dimmed">
                0
              </Text>
            );
          }
          return (
            <Text size="sm" fw={500}>
              {formatTokenCount(tokenUsage.total_tokens)}
            </Text>
          );
        },
      },
      {
        accessor: 'token_usage.input_tokens',
        title: '输入Token',
        width: 100,
        render: (report: ReportListItem) => {
          const tokenUsage = report.token_usage;
          if (!tokenUsage || tokenUsage.input_tokens === 0) {
            return (
              <Text size="sm" c="dimmed">
                0
              </Text>
            );
          }
          return (
            <Text size="sm" c="blue">
              {formatTokenCount(tokenUsage.input_tokens)}
            </Text>
          );
        },
      },
      {
        accessor: 'token_usage.output_tokens',
        title: '输出Token',
        width: 100,
        render: (report: ReportListItem) => {
          const tokenUsage = report.token_usage;
          if (!tokenUsage || tokenUsage.output_tokens === 0) {
            return (
              <Text size="sm" c="dimmed">
                0
              </Text>
            );
          }
          return (
            <Text size="sm" c="green">
              {formatTokenCount(tokenUsage.output_tokens)}
            </Text>
          );
        },
      },
      {
        accessor: 'token_usage.request_count',
        title: '请求次数',
        width: 90,
        render: (report: ReportListItem) => {
          const tokenUsage = report.token_usage;
          if (!tokenUsage || tokenUsage.request_count === 0) {
            return (
              <Text size="sm" c="dimmed">
                0
              </Text>
            );
          }
          return (
            <Text size="sm" c="purple" fw={500}>
              {tokenUsage.request_count}
            </Text>
          );
        },
      },
      {
        accessor: 'token_usage.estimated_cost',
        title: '估算成本',
        width: 100,
        render: (report: ReportListItem) => {
          const tokenUsage = report.token_usage;
          if (!tokenUsage || tokenUsage.estimated_cost === 0) {
            return (
              <Text size="sm" c="dimmed">
                $0
              </Text>
            );
          }
          return (
            <Text size="sm" fw={600} c="orange">
              {formatCurrency(tokenUsage.estimated_cost)}
            </Text>
          );
        },
      },
      {
        accessor: 'generationTime',
        title: '生成时间',
        width: 100,
        render: (report: ReportListItem) => (
          <Text size="sm">{formatGenerationTime(report.generationTime)}</Text>
        ),
      },
      {
        accessor: 'createdAt',
        title: '创建时间',
        width: 140,
        render: (report: ReportListItem) => (
          <Text size="sm">
            {formatTimestamp.dateTime(report.createdAt)}
          </Text>
        ),
      },
      {
        accessor: 'actions',
        title: '操作',
        width: 80,
        render: (report: ReportListItem) => (
          <ActionIcon
            variant="light"
            color="blue"
            size="sm"
            onClick={() => window.open(`https://chat.fellou.ai/report/${report.id}`, '_blank')}
            title="查看报告"
          >
            <IconExternalLink size={14} />
          </ActionIcon>
        ),
      },
    ];

    return [...baseColumns, ...additionalColumns];
  }, [expandedReportId, showUserColumn, userIdFilter]);

  return (
    <Paper p="md" shadow="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>报告列表</Title>
          <Group gap="sm">
            <Text size="sm" c="dimmed">
              共 {total} 个报告
            </Text>
            <ActionIcon variant="light" onClick={onRefresh} loading={loading}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <DataTable
          pinLastColumn={true}
          pinFirstColumn={false}
          columns={columns}
          records={data}
          totalRecords={total}
          recordsPerPage={pageSize}
          page={page}
          verticalSpacing="xs"
          horizontalSpacing="xs"
          striped={true}
          onPageChange={onPageChange}
          fetching={loading}
          noRecordsText="暂无报告数据"
          loadingText="正在加载报告数据..."
          paginationText={({ from, to, totalRecords }) =>
            `显示 ${from} - ${to} 条，共 ${totalRecords} 条记录`
          }
          minHeight={400}
          rowExpansion={{
            allowMultiple: false,
            expanded: {
              recordIds: expandedReportId ? [expandedReportId] : [],
              // 不再响应 DataTable 的行点击事件，只由 chevron 按钮控制
              onRecordIdsChange: () => {},
            },
            content: ({ record }) => renderExpandedContent(record),
          }}
        />
      </Stack>
    </Paper>
  );
} 