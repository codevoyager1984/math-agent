'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Stack,
  Group,
  Button,
  Text,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  LoadingOverlay,
  Pagination,
  Modal,
  ScrollArea,
  Card,
  Divider,
} from '@mantine/core';
import {
  IconEye,
  IconMessageCircle,
  IconRefresh,
  IconFileText,
  IconCalendar,
  IconX,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader/PageHeader';
import { 
  getDocuments, 
  getDocumentSessions, 
  Document, 
  ChatSession, 
  DocumentListParams 
} from '@/api/documents';


const RECORDS_PER_PAGE = 20;

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  
  // Modal states
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [documentSessions, setDocumentSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // 获取文档列表
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      
      const params: DocumentListParams = {
        page,
        limit: RECORDS_PER_PAGE
      };
      
      const response = await getDocuments(params);
      setDocuments(response.documents);
      setTotalRecords(response.total);
      
    } catch (error) {
      console.error('获取文档列表失败:', error);
      toast.error('获取文档列表失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  // 获取文档的会话列表
  const fetchDocumentSessions = useCallback(async (documentId: string) => {
    try {
      setLoadingSessions(true);
      
      const sessions = await getDocumentSessions(documentId);
      setDocumentSessions(sessions);
      
    } catch (error) {
      console.error('获取会话列表失败:', error);
      toast.error('获取会话列表失败');
      setDocumentSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // 查看文档详情
  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setShowDetailModal(true);
    fetchDocumentSessions(document.id);
  };

  // 进入聊天会话
  const handleViewSession = (session: ChatSession) => {
    router.push(`/dashboard/knowledge-base/chat?sessionId=${session.id}&filename=${encodeURIComponent(selectedDocument?.filename || '')}`);
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'processing': return 'blue';
      case 'uploading': return 'yellow';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'processing': return '处理中';
      case 'uploading': return '上传中';
      case 'failed': return '失败';
      default: return '未知';
    }
  };

  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'blue';
      case 'completed': return 'green';
      case 'expired': return 'gray';
      default: return 'gray';
    }
  };

  const getSessionStatusText = (status: string) => {
    switch (status) {
      case 'active': return '活跃';
      case 'completed': return '已完成';
      case 'expired': return '已过期';
      default: return '未知';
    }
  };

  return (
    <Container fluid>
      <Stack gap="lg">
        <PageHeader title="文档管理" />

        {/* 操作栏 */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            共 {totalRecords} 个文档
          </Text>
          <Group gap="sm">
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={fetchDocuments}
            >
              刷新
            </Button>
          </Group>
        </Group>

        {/* 文档表格 */}
        <div style={{ position: 'relative' }}>
          <LoadingOverlay visible={loading} />
          
          {documents.length === 0 && !loading ? (
            <Text ta="center" c="dimmed" py="xl">
              暂无文档数据
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>文件名</Table.Th>
                  <Table.Th>大小</Table.Th>
                  <Table.Th>类型</Table.Th>
                  <Table.Th>状态</Table.Th>
                  <Table.Th>上传时间</Table.Th>
                  <Table.Th>操作</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {documents.map((document) => (
                  <Table.Tr key={document.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <IconFileText size={16} />
                        <div>
                          <Text size="sm" fw={500}>{document.filename}</Text>
                          <Text size="xs" c="dimmed">{document.original_filename}</Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatFileSize(document.file_size)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {document.file_type.toUpperCase()}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(document.status)} variant="light">
                        {getStatusText(document.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <IconCalendar size={14} />
                        <Text size="xs">
                          {new Date(document.created_at).toLocaleString()}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="查看详情">
                          <ActionIcon
                            variant="light"
                            size="sm"
                            onClick={() => handleViewDocument(document)}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </div>

        {/* 分页 */}
        {Math.ceil(totalRecords / RECORDS_PER_PAGE) > 1 && (
          <Group justify="center" mt="lg">
            <Pagination
              value={page}
              onChange={setPage}
              total={Math.ceil(totalRecords / RECORDS_PER_PAGE)}
            />
          </Group>
        )}

        {/* 文档详情模态框 */}
        <Modal
          opened={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={
            <Group gap="sm">
              <IconFileText size={20} />
              <Text fw={600}>文档详情</Text>
            </Group>
          }
          size="xl"
        >
          {selectedDocument && (
            <Stack gap="lg">
              {/* 文档基本信息 */}
              <Card withBorder p="md">
                <Stack gap="sm">
                  <Text fw={600} size="lg">{selectedDocument.filename}</Text>
                  
                  <Group gap="lg">
                    <div>
                      <Text size="xs" c="dimmed">文件大小</Text>
                      <Text size="sm">{formatFileSize(selectedDocument.file_size)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">文件类型</Text>
                      <Badge variant="light">{selectedDocument.file_type.toUpperCase()}</Badge>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">状态</Text>
                      <Badge color={getStatusColor(selectedDocument.status)} variant="light">
                        {getStatusText(selectedDocument.status)}
                      </Badge>
                    </div>
                  </Group>

                  <div>
                    <Text size="xs" c="dimmed">上传时间</Text>
                    <Text size="sm">{new Date(selectedDocument.created_at).toLocaleString()}</Text>
                  </div>

                  {selectedDocument.user_requirements && (
                    <div>
                      <Text size="xs" c="dimmed">用户要求</Text>
                      <Text size="sm">{selectedDocument.user_requirements}</Text>
                    </div>
                  )}

                  {selectedDocument.text_preview && (
                    <div>
                      <Text size="xs" c="dimmed">文本预览</Text>
                      <ScrollArea mah={200}>
                        <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                          {selectedDocument.text_preview}
                        </Text>
                      </ScrollArea>
                    </div>
                  )}
                </Stack>
              </Card>

              <Divider />

              {/* 关联的聊天会话 */}
              <div>
                <Group justify="space-between" mb="md">
                  <Text fw={600} size="lg">关联的聊天会话</Text>
                  <Badge variant="light">
                    {documentSessions.length} 个会话
                  </Badge>
                </Group>

                <div style={{ position: 'relative' }}>
                  <LoadingOverlay visible={loadingSessions} />
                  
                  {documentSessions.length === 0 ? (
                    <Text ta="center" c="dimmed" py="md">
                      暂无关联的聊天会话
                    </Text>
                  ) : (
                    <Stack gap="sm">
                      {documentSessions.map((session) => (
                        <Card key={session.id} withBorder p="md" style={{ cursor: 'pointer' }}>
                          <Group justify="space-between" align="flex-start">
                            <div style={{ flex: 1 }}>
                              <Group gap="sm" mb="xs">
                                <IconMessageCircle size={16} />
                                <Text fw={500} size="sm">
                                  会话 {session.id.slice(0, 8)}...
                                </Text>
                                <Badge color={getSessionStatusColor(session.status)} variant="light" size="sm">
                                  {getSessionStatusText(session.status)}
                                </Badge>
                              </Group>
                              
                              <Group gap="lg" mb="xs">
                                <div>
                                  <Text size="xs" c="dimmed">创建时间</Text>
                                  <Text size="xs">{new Date(session.created_at).toLocaleString()}</Text>
                                </div>
                                <div>
                                  <Text size="xs" c="dimmed">最后活动</Text>
                                  <Text size="xs">{new Date(session.last_activity).toLocaleString()}</Text>
                                </div>
                                <div>
                                  <Text size="xs" c="dimmed">知识点</Text>
                                  <Text size="xs">{session.current_knowledge_points?.length || 0} 个</Text>
                                </div>
                              </Group>
                            </div>
                            
                            <Button
                              size="xs"
                              variant="light"
                              leftSection={<IconEye size={14} />}
                              onClick={() => handleViewSession(session)}
                            >
                              查看对话
                            </Button>
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </div>
              </div>
            </Stack>
          )}
        </Modal>
      </Stack>
    </Container>
  );
}
