'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Container,
  Stack,
  Group,
  Button,
  Text,
  Paper,
  Badge,
  Alert,
  Progress,
  Title,
  Breadcrumbs,
  Anchor,
  FileInput,
  Textarea,
} from '@mantine/core';
import {
  IconUpload,
  IconArrowLeft,
  IconHome,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconFileTypeTxt,
  IconFile,
  IconInfoCircle,
  IconSparkles,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { parseDocumentAndCreateSession } from '@/api/knowledge';

export default function UploadPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [userRequirements, setUserRequirements] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 从URL参数获取初始值
  useEffect(() => {
    const requirements = searchParams.get('requirements');
    if (requirements) setUserRequirements(decodeURIComponent(requirements));
  }, [searchParams]);

  const getFileIcon = (fileName: string) => {
    const name = fileName.toLowerCase();
    if (name.endsWith('.pdf')) return <IconFileTypePdf size={20} color="#e03131" />;
    if (name.endsWith('.docx') || name.endsWith('.doc')) return <IconFileTypeDocx size={20} color="#1971c2" />;
    if (name.endsWith('.txt') || name.endsWith('.md')) return <IconFileTypeTxt size={20} color="#495057" />;
    return <IconFile size={20} color="#868e96" />;
  };

  const validateFile = (selectedFile: File): string | null => {
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxFileSize) {
      return '文件大小不能超过 10MB';
    }

    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.md'];
    const fileExtension = selectedFile.name.toLowerCase().split('.').pop();
    if (!fileExtension || !allowedTypes.some(type => type.includes(fileExtension))) {
      return `不支持的文件格式。支持的格式：${allowedTypes.join(', ')}`;
    }

    return null;
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('请选择要上传的文件');
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
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

      const result = await parseDocumentAndCreateSession(file, userRequirements);

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast.success('文档上传成功！跳转到AI分析页面...');
      
      // 跳转到分析页面
      router.push(`/dashboard/knowledge-base/chat?sessionId=${result.session_id}&filename=${encodeURIComponent(result.filename)}}`);

    } catch (error) {
      console.error('文档上传失败:', error);
      toast.error('文档上传失败，请重试');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const breadcrumbItems = [
    { title: '首页', href: '/dashboard', icon: IconHome },
    { title: '知识库', href: '/dashboard/knowledge-base' },
    { title: '上传文档', href: '#' },
  ].map((item, index) => (
    <Anchor key={index} onClick={() => router.push(item.href)} size="sm">
      <Group gap="xs">
        {item.icon && <item.icon size={14} />}
        {item.title}
      </Group>
    </Anchor>
  ));

  return (
    <Container size="xl" py="md" fluid>
      <Stack gap="lg">
        {/* 页面头部 */}
        <div>
          <Breadcrumbs separator=">" mb="sm">
            {breadcrumbItems}
          </Breadcrumbs>
        </div>

        {/* 上传进度 */}
        {uploading && (
          <Alert icon={<IconSparkles size={16} />} color="blue">
            <Stack gap="xs">
              <Text size="sm">正在上传和分析文档...</Text>
              <Progress value={uploadProgress} size="sm" />
              <Text size="xs" c="dimmed">
                {uploadProgress < 30 && '正在上传文件...'}
                {uploadProgress >= 30 && uploadProgress < 70 && '正在提取文本内容...'}
                {uploadProgress >= 70 && uploadProgress < 100 && '正在创建AI分析会话...'}
                {uploadProgress >= 100 && '即将跳转到分析页面...'}
              </Text>
            </Stack>
          </Alert>
        )}

        {/* 主要内容 */}
        <Paper withBorder p="xl" radius="md">
          <Stack gap="lg">
            <div>
              <Text fw={600} size="lg" mb="sm">选择文档文件</Text>
              <FileInput
                placeholder="点击选择文件或拖拽文件到此处"
                value={file}
                onChange={setFile}
                accept=".pdf,.docx,.doc,.txt,.md"
                size="lg"
                disabled={uploading}
                leftSection={<IconUpload size={20} />}
              />
              
              {file && (
                <Group gap="sm" mt="sm">
                  {getFileIcon(file.name)}
                  <div>
                    <Text size="sm" fw={500}>{file.name}</Text>
                    <Text size="xs" c="dimmed">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </div>
                  <Badge variant="light" color="green">已选择</Badge>
                </Group>
              )}
            </div>

            <div>
              <Text fw={600} size="lg" mb="sm">生成设置</Text>
              <Textarea
                label="特殊要求"
                description="对知识点提取的特殊要求（可选）"
                placeholder="例如：重点关注公式和定理，包含详细的解题步骤..."
                value={userRequirements}
                onChange={(e) => setUserRequirements(e.currentTarget.value)}
                minRows={3}
                maxRows={6}
                disabled={uploading}
              />
            </div>

            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              <Stack gap="xs">
                <Text size="sm" fw={500}>支持的文件格式：</Text>
                <Text size="xs">
                  • PDF 文档 (.pdf)
                  <br />
                  • Word 文档 (.docx, .doc)
                  <br />
                  • 文本文件 (.txt, .md)
                  <br />
                  • 文件大小限制：10MB
                </Text>
              </Stack>
            </Alert>

            <Group justify="center" mt="xl">
              <Button
                size="lg"
                leftSection={<IconSparkles size={20} />}
                onClick={handleUpload}
                disabled={!file || uploading}
                loading={uploading}
              >
                {uploading ? '正在处理...' : '开始AI分析'}
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
