import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { Badge, Group, Stack, Title } from '@mantine/core';
import { getReportDetail, getReportList, ReportDetail, ReportListItem } from '@/api/report';
import ReportRecordsTable from '@/components/common/ReportRecordsTable';

interface UserReportRecordsTabProps {
  userId: string;
  isActive?: boolean;
}

export default function UserReportRecordsTab({ userId, isActive = true }: UserReportRecordsTabProps) {
  // 报告记录相关状态
  const [reportData, setReportData] = useState<ReportListItem[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState<Record<string, ReportDetail>>({});
  const [reportDetailLoading, setReportDetailLoading] = useState<string | null>(null);
  
  // 懒加载状态
  const hasInitialized = useRef(false);

  const REPORT_PAGE_SIZE = 10;

  // 日期范围 - 最近30天
  const dateRange = React.useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return [start, end];
  }, []);

  // 获取用户的报告记录
  const fetchReportData = async (page = 1) => {
    try {
      setReportLoading(true);
      const response = await getReportList({
        user_id: userId,
        start_date: dateRange[0]?.toISOString().split('T')[0],
        end_date: dateRange[1]?.toISOString().split('T')[0],
        page,
        page_size: REPORT_PAGE_SIZE,
      });
      setReportData(response.items);
      setReportTotal(response.total);
      setReportPage(page);
    } catch (err: any) {
      console.error('获取报告记录失败:', err);
      toast.error('获取报告记录失败');
    } finally {
      setReportLoading(false);
    }
  };

  // 获取报告详情
  const fetchReportDetail = async (reportId: string) => {
    if (reportDetails[reportId]) {
      return;
    }

    try {
      setReportDetailLoading(reportId);
      const response = await getReportDetail(reportId);
      setReportDetails((prev) => ({ ...prev, [reportId]: response }));
    } catch (err: any) {
      console.error('获取报告详情失败:', err);
      toast.error('获取报告详情失败');
    } finally {
      setReportDetailLoading(null);
    }
  };

  // 切换报告展开状态
  const toggleReportExpansion = (reportId: string) => {
    const targetId = reportId === '' ? null : reportId;
    setExpandedReportId(targetId);
  };

  // 处理报告分页
  const handleReportPageChange = (page: number) => {
    fetchReportData(page);
  };

  // 懒加载：只在第一次激活时获取数据
  useEffect(() => {
    if (isActive && !hasInitialized.current) {
      hasInitialized.current = true;
      fetchReportData();
    }
  }, [userId, isActive]);

  return (
    <ReportRecordsTable
      data={reportData}
      total={reportTotal}
      page={reportPage}
      pageSize={REPORT_PAGE_SIZE}
      loading={reportLoading}
      onPageChange={handleReportPageChange}
      onRefresh={() => fetchReportData(reportPage)}
      expandedReportId={expandedReportId}
      reportDetails={reportDetails}
      detailLoading={reportDetailLoading}
      onRowExpand={toggleReportExpansion}
      onFetchDetail={fetchReportDetail}
      showUserColumn={false} // 用户详情页不显示用户列
      userIdFilter={userId}
    />
  );
}
