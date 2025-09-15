import React, { useState, useCallback } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  FileInput,
  NumberInput,
  Textarea,
  Alert,
  Progress,
  LoadingOverlay,
  List,
  ThemeIcon,
  Badge,
  rem,
} from '@mantine/core';
import {
  IconUpload,
  IconFile,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconFileTypeTxt,
  IconMarkdown,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { parseDocumentAndCreateSession, DocumentParseSessionResponse, DocumentInput } from '@/api/knowledge';
import KnowledgePointPreview from './KnowledgePointPreview';
import { useRouter } from 'next/navigation';

interface DocumentUploadModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SUPPORTED_FORMATS = [
  { ext: '.pdf', name: 'PDF文档', icon: IconFileTypePdf, color: 'red' },
  { ext: '.docx/.doc', name: 'Word文档', icon: IconFileTypeDocx, color: 'blue' },
  { ext: '.txt', name: '文本文件', icon: IconFileTypeTxt, color: 'gray' },
  { ext: '.md/.markdown', name: 'Markdown文件', icon: IconMarkdown, color: 'dark' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function DocumentUploadModal({
  opened,
  onClose,
  onSuccess,
}: DocumentUploadModalProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [maxKnowledgePoints, setMaxKnowledgePoints] = useState(10);
  const [userRequirements, setUserRequirements] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sessionResult, setSessionResult] = useState<DocumentParseSessionResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [finalKnowledgePoints, setFinalKnowledgePoints] = useState<DocumentInput[]>([]);
  const [hasSessionCreated, setHasSessionCreated] = useState(false);

  const handleClose = useCallback(() => {
    setFile(null);
    setMaxKnowledgePoints(10);
    setUserRequirements('');
    setUploading(false);
    setUploadProgress(0);
    setSessionResult(null);
    setShowPreview(false);
    setFinalKnowledgePoints([]);
    setHasSessionCreated(false);
    onClose();
  }, [onClose]);

  const validateFile = (selectedFile: File): string | null => {
    // 检查文件大小
    if (selectedFile.size > MAX_FILE_SIZE) {
      return `文件大小超过限制（最大 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB）`;
    }

    // 检查文件类型
    const fileName = selectedFile.name.toLowerCase();
    const supportedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.md', '.markdown'];
    const isSupported = supportedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isSupported) {
      return '不支持的文件格式';
    }

    return null;
  };

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }

    const error = validateFile(selectedFile);
    if (error) {
      toast.error(error);
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('请选择要上传的文件');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 200);

      const result = await parseDocumentAndCreateSession(file, maxKnowledgePoints, userRequirements);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // 保存会话结果并导航到分析页面
      setSessionResult(result);
      setHasSessionCreated(true);

      toast.success('文档上传成功！跳转到AI分析页面...');
      
      // 关闭当前modal并导航到分析页面
      onClose();
      router.push(`/dashboard/knowledge-base/chat?sessionId=${result.session_id}&filename=${encodeURIComponent(result.filename)}&preview=${encodeURIComponent(result.extracted_text_preview)}`);

    } catch (error) {
      console.error('文档上传失败:', error);
      toast.error('文档上传失败，请重试');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  // 处理聊天界面生成的知识点
  const handleKnowledgePointsReady = useCallback((knowledgePoints: DocumentInput[]) => {
    setFinalKnowledgePoints(knowledgePoints);
    setShowPreview(true);
  }, []);

  const getFileIcon = (fileName: string) => {
    const name = fileName.toLowerCase();
    if (name.endsWith('.pdf')) return <IconFileTypePdf size={16} color="#e03131" />;
    if (name.endsWith('.docx') || name.endsWith('.doc')) return <IconFileTypeDocx size={16} color="#1971c2" />;
    if (name.endsWith('.txt')) return <IconFileTypeTxt size={16} color="#868e96" />;
    if (name.endsWith('.md') || name.endsWith('.markdown')) return <IconMarkdown size={16} color="#343a40" />;
    return <IconFile size={16} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Modal
        opened={opened && !showPreview}
        onClose={handleClose}
        title={
          <Group gap="sm">
            <IconUpload size={20} />
            <Text fw={600}>上传文档</Text>
          </Group>
        }
        size="xl"
      >
        <div style={{ position: 'relative' }}>
          <LoadingOverlay visible={uploading} />
          
          <Stack gap="md">
            {/* 上传进度 */}
            {uploading && (
              <Alert icon={<IconInfoCircle size={16} />} color="blue">
                <Stack gap="xs">
                  <Text size="sm">正在解析文档并生成知识点...</Text>
                  <Progress value={uploadProgress} size="sm" />
                  <Text size="xs" c="dimmed">
                    请耐心等待 2-3 分钟，系统正在使用 AI 分析文档内容并生成结构化知识点
                  </Text>
                </Stack>
              </Alert>
            )}

            {/* 支持格式说明 */}
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              <Stack gap="sm">
                <Text size="sm" fw={500}>支持的文件格式：</Text>
                <List spacing="xs" size="sm">
                  {SUPPORTED_FORMATS.map((format) => (
                    <List.Item
                      key={format.ext}
                      icon={
                        <ThemeIcon color={format.color} size={24} radius="xl">
                          <format.icon size={16} />
                        </ThemeIcon>
                      }
                    >
                      <Group gap="xs">
                        <Text>{format.name}</Text>
                        <Badge size="xs" variant="light">
                          {format.ext}
                        </Badge>
                      </Group>
                    </List.Item>
                  ))}
                </List>
                <Text size="xs" c="dimmed">
                  文件大小限制：最大 {Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB
                </Text>
                <Text size="xs" c="orange" fw={500}>
                  ⏱️ 预计处理时间：2-3 分钟（根据文档大小和复杂程度而定）
                </Text>
              </Stack>
            </Alert>

            {/* 文件选择 */}
            <FileInput
              label="选择文档"
              placeholder="点击选择文件或拖拽文件到此处"
              value={file}
              onChange={handleFileChange}
              accept=".pdf,.docx,.doc,.txt,.md,.markdown"
              leftSection={<IconFile size={16} />}
              disabled={uploading}
            />

            {/* 文件信息 */}
            {file && (
              <Alert icon={getFileIcon(file.name)} color="green" variant="light">
                <Group justify="space-between">
                  <Stack gap={4}>
                    <Text size="sm" fw={500}>{file.name}</Text>
                    <Text size="xs" c="dimmed">
                      文件大小: {formatFileSize(file.size)}
                    </Text>
                    {hasSessionCreated && (
                      <Text size="xs" c="blue" fw={500}>
                        已创建会话，可进入AI分析
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={4} align="flex-end">
                    <Badge color="green" variant="light">
                      ✓ 已选择
                    </Badge>
                    {hasSessionCreated && (
                      <Badge color="blue" variant="light">
                        已上传
                      </Badge>
                    )}
                  </Stack>
                </Group>
              </Alert>
            )}

            {/* AI分析提示 */}
            {hasSessionCreated && (
              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                <Text size="sm">
                  🤖 文档已上传成功！您可以点击"进入AI分析"开始与AI对话来生成知识点，或修改参数重新上传
                </Text>
              </Alert>
            )}

            {/* 用户要求 */}
            <Textarea
              label="额外要求（可选）"
              description="您可以在此输入对知识点提取的特殊要求，例如：重点关注某个概念、特定的难度等级、或其他定制化需求"
              placeholder="例如：重点提取关于二次函数的例题，难度偏向中等..."
              value={userRequirements}
              onChange={(event) => setUserRequirements(event.currentTarget.value)}
              minRows={3}
              maxRows={5}
              disabled={uploading}
            />

            {/* 参数设置 */}
            <NumberInput
              label="最大知识点数量"
              description="AI将从文档中提取的最大知识点数量"
              value={maxKnowledgePoints}
              onChange={(value) => setMaxKnowledgePoints(Number(value) || 10)}
              min={1}
              max={20}
              disabled={uploading}
            />

            {/* 操作按钮 */}
            <Group justify="space-between" mt="md">
              <Button
                variant="subtle"
                leftSection={<IconX size={16} />}
                onClick={handleClose}
                disabled={uploading}
              >
                取消
              </Button>
              
              <Group gap="sm">
                {hasSessionCreated && sessionResult && (
                  <Button
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan' }}
                    leftSection={<IconRefresh size={16} />}
                    onClick={() => {
                      onClose();
                      router.push(`/dashboard/knowledge-base/chat?sessionId=${sessionResult.session_id}&filename=${encodeURIComponent(sessionResult.filename)}&preview=${encodeURIComponent(sessionResult.extracted_text_preview)}`);
                    }}
                  >
                    进入AI分析
                  </Button>
                )}

                <Button
                  leftSection={<IconUpload size={16} />}
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  loading={uploading}
                >
                  {hasSessionCreated ? '重新上传' : '上传文档'}
                </Button>
              </Group>
            </Group>
          </Stack>
        </div>
      </Modal>


      {/* 知识点预览模态框 */}
      {finalKnowledgePoints.length > 0 && sessionResult && (
        <KnowledgePointPreview
          opened={showPreview}
          onClose={() => {
            setShowPreview(false);
            handleClose();
          }}
          filename={sessionResult.filename}
          extractedText={sessionResult.extracted_text_preview}
          knowledgePoints={finalKnowledgePoints}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}