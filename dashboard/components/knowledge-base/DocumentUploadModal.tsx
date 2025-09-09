import React, { useState, useCallback } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  FileInput,
  NumberInput,
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
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { parseDocument, DocumentParseResponse } from '@/api/knowledge';
import KnowledgePointPreview from './KnowledgePointPreview';

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
  const [file, setFile] = useState<File | null>(null);
  const [maxKnowledgePoints, setMaxKnowledgePoints] = useState(10);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseResult, setParseResult] = useState<DocumentParseResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleClose = useCallback(() => {
    setFile(null);
    setMaxKnowledgePoints(10);
    setUploading(false);
    setUploadProgress(0);
    setParseResult(null);
    setShowPreview(false);
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

      const result = await parseDocument(file, maxKnowledgePoints);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      // 显示结果
      setParseResult(result);
      setShowPreview(true);
      
      toast.success(`成功解析文档，生成了 ${result.total_points} 个知识点`);

    } catch (error) {
      console.error('文档解析失败:', error);
      toast.error('文档解析失败，请重试');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

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
        size="md"
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
                  </Stack>
                  <Badge color="green" variant="light">
                    ✓ 已选择
                  </Badge>
                </Group>
              </Alert>
            )}

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
              
              <Button
                leftSection={<IconUpload size={16} />}
                onClick={handleUpload}
                disabled={!file || uploading}
                loading={uploading}
              >
                开始解析
              </Button>
            </Group>
          </Stack>
        </div>
      </Modal>

      {/* 知识点预览模态框 */}
      {parseResult && (
        <KnowledgePointPreview
          opened={showPreview}
          onClose={() => {
            setShowPreview(false);
            handleClose();
          }}
          filename={parseResult.filename}
          extractedText={parseResult.extracted_text}
          knowledgePoints={parseResult.knowledge_points}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}