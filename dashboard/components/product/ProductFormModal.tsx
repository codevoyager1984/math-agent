'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  NumberInput,
  Textarea,
  Switch,
  Button,
  Group,
  LoadingOverlay,
  Text,
  Tabs,
  Card,
  Image,
  FileInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { 
  IconDeviceFloppy, 
  IconX, 
  IconPhoto, 
  IconMarkdown, 
  IconEye,
  IconUpload
} from '@tabler/icons-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { 
  createProduct, 
  updateProduct, 
  Product, 
  ProductCreateRequest, 
  ProductUpdateRequest 
} from '@/api/product';
import { uploadImage, validateImageFile, UploadResponse } from '@/api/upload';

interface ProductFormModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null; // 如果提供了product，则为编辑模式
}

interface FormValues {
  name: string;
  cover_image: string;
  description: string;
  rental_period: number;
  monthly_price: number;
  service_fee: number;
  is_active: boolean;
}

export default function ProductFormModal({ 
  opened, 
  onClose, 
  onSuccess, 
  product 
}: ProductFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const isEditMode = !!product;

  const form = useForm<FormValues>({
    initialValues: {
      name: '',
      cover_image: '',
      description: '',
      rental_period: 1,
      monthly_price: 0,
      service_fee: 49.9,
      is_active: true,
    },
    validate: {
      name: (value) => {
        if (!value || value.trim().length === 0) {
          return '请输入商品名称';
        }
        if (value.trim().length > 255) {
          return '商品名称不能超过255个字符';
        }
        return null;
      },
      cover_image: (value) => {
        if (!value || value.trim().length === 0) {
          return '请上传封面图片';
        }
        return null;
      },
      rental_period: (value) => {
        if (!value || value < 1) {
          return '租期必须大于0个月';
        }
        if (value > 120) {
          return '租期不能超过120个月';
        }
        return null;
      },
      monthly_price: (value) => {
        if (!value || value <= 0) {
          return '每月金额必须大于0';
        }
        if (value > 999999.99) {
          return '每月金额不能超过999999.99元';
        }
        return null;
      },
      service_fee: (value) => {
        if (value < 0) {
          return '服务费不能小于0';
        }
        if (value > 999999.99) {
          return '服务费不能超过999999.99元';
        }
        return null;
      },
    },
  });

  // 当产品数据变化时，更新表单
  useEffect(() => {
    if (product && opened) {
      form.setValues({
        name: product.name,
        cover_image: product.cover_image || '',
        description: product.description || '',
        rental_period: product.rental_period,
        monthly_price: product.monthly_price,
        service_fee: product.service_fee,
        is_active: product.is_active,
      });
      setImagePreview(product.cover_image || '');
    } else if (opened && !product) {
      // 新增模式，重置表单
      form.reset();
      setImagePreview('');
      setImageFile(null);
    }
  }, [product, opened]);

  // 处理图片文件选择
  const handleImageFileChange = async (file: File | null) => {
    setImageFile(file);
    if (file) {
      // 验证文件
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast.error(validation.error || '文件验证失败');
        setImageFile(null);
        return;
      }

      // 显示本地预览
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
      };
      reader.readAsDataURL(file);

      // 上传文件到OSS
      try {
        setLoading(true);
        toast.loading('正在上传图片...', { id: 'upload-image' });
        
        const uploadResult: UploadResponse = await uploadImage(file);
        
        if (uploadResult.success && uploadResult.url) {
          // 上传成功，设置表单值为OSS URL
          form.setFieldValue('cover_image', uploadResult.url);
          toast.success('图片上传成功', { id: 'upload-image' });
        } else {
          throw new Error(uploadResult.message || '上传失败');
        }
      } catch (error) {
        console.error('上传图片失败:', error);
        toast.error(`图片上传失败: ${error instanceof Error ? error.message : '未知错误'}`, { id: 'upload-image' });
        // 清除预览和文件选择
        setImagePreview('');
        setImageFile(null);
        form.setFieldValue('cover_image', '');
      } finally {
        setLoading(false);
      }
    } else {
      setImagePreview('');
      form.setFieldValue('cover_image', '');
    }
  };



  // 提交表单
  const handleSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      if (isEditMode && product) {
        // 编辑模式
        const updateData: ProductUpdateRequest = {
          name: values.name.trim(),
          cover_image: values.cover_image.trim() || undefined,
          description: values.description.trim() || undefined,
          rental_period: values.rental_period,
          monthly_price: values.monthly_price,
          service_fee: values.service_fee,
          is_active: values.is_active,
        };

        await updateProduct(product.id, updateData);
        toast.success('商品更新成功');
      } else {
        // 新增模式
        const createData: ProductCreateRequest = {
          name: values.name.trim(),
          cover_image: values.cover_image.trim(), // 封面图片现在是必填项
          description: values.description.trim() || undefined,
          rental_period: values.rental_period,
          monthly_price: values.monthly_price,
          service_fee: values.service_fee,
        };

        await createProduct(createData);
        toast.success('商品创建成功');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('保存商品失败:', error);
      toast.error(isEditMode ? '更新商品失败' : '创建商品失败');
    } finally {
      setLoading(false);
    }
  };

  // 关闭弹窗
  const handleClose = () => {
    if (!loading) {
      form.reset();
      setImageFile(null);
      setImagePreview('');
      onClose();
    }
  };

  // 渲染Markdown预览
  const renderMarkdownPreview = () => {
    const description = form.values.description;
    if (!description.trim()) {
      return (
        <Text c="dimmed" ta="center" py="xl">
          暂无内容预览
        </Text>
      );
    }

    return (
      <div 
        style={{ 
          padding: '1rem',
          border: '1px solid #e9ecef',
          borderRadius: '8px',
          backgroundColor: '#f8f9fa',
          minHeight: '260px'
        }}
      >
        <ReactMarkdown
          components={{
            h1: ({ children }) => <Text size="xl" fw={700} mb="sm">{children}</Text>,
            h2: ({ children }) => <Text size="lg" fw={600} mb="sm">{children}</Text>,
            h3: ({ children }) => <Text size="md" fw={500} mb="xs">{children}</Text>,
            p: ({ children }) => <Text mb="sm">{children}</Text>,
            ul: ({ children }) => <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>{children}</ol>,
            li: ({ children }) => <li style={{ marginBottom: '0.25rem' }}>{children}</li>,
            strong: ({ children }) => <Text component="strong" fw={600}>{children}</Text>,
            em: ({ children }) => <Text component="em" fs="italic">{children}</Text>,
            code: ({ children }) => (
              <Text 
                component="code" 
                bg="gray.1" 
                px="xs" 
                py={2} 
                style={{ borderRadius: '4px', fontSize: '0.875em' }}
              >
                {children}
              </Text>
            ),
            pre: ({ children }) => (
              <div style={{ 
                backgroundColor: '#f1f3f4', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginBottom: '1rem',
                overflow: 'auto'
              }}>
                {children}
              </div>
            ),
          }}
        >
          {description}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={isEditMode ? '编辑商品' : '新增商品'}
      size="lg"
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <div style={{ position: 'relative' }}>
        <LoadingOverlay visible={loading} />
        
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {/* 基本信息 */}
            <TextInput
              label="商品名称"
              placeholder="请输入商品名称"
              required
              {...form.getInputProps('name')}
            />

            {/* 封面图片 */}
            <Stack gap="xs">
              <Text size="sm" fw={500}>封面图片 <Text component="span" c="red">*</Text></Text>
              
              <Stack gap="xs">
                <FileInput
                  placeholder="选择图片文件"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  value={imageFile}
                  onChange={handleImageFileChange}
                  leftSection={<IconUpload size={16} />}
                  disabled={loading}
                  required
                  error={form.errors.cover_image}
                />
                <Text size="xs" c="dimmed">
                  支持格式：JPEG、PNG、GIF、WebP，最大文件大小：5MB
                </Text>
              </Stack>

              {/* 图片预览 */}
              {imagePreview && (
                <Card withBorder p="sm">
                  <Text size="xs" c="dimmed" mb="xs">预览：</Text>
                  <Image
                    src={imagePreview}
                    alt="商品封面预览"
                    h={120}
                    w="auto"
                    radius="sm"
                    fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDIwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik04MCA2MEM4MCA1OC44OTU0IDgwLjg5NTQgNTggODIgNThIODhDODkuMTA0NiA1OCA5MCA1OC44OTU0IDkwIDYwVjY2QzkwIDY3LjEwNDYgODkuMTA0NiA2OCA4OCA2OEg4MkM4MC44OTU0IDY4IDgwIDY3LjEwNDYgODAgNjZWNjBaIiBmaWxsPSIjQzNDM0MzIi8+Cjwvc3ZnPgo="
                  />
                </Card>
              )}
            </Stack>

            {/* 商品介绍 */}
            <Stack gap="xs">
              <Text size="sm" fw={500}>商品介绍</Text>
              
              <Tabs defaultValue="edit">
                <Tabs.List>
                  <Tabs.Tab value="edit" leftSection={<IconMarkdown size={14} />}>
                    编辑
                  </Tabs.Tab>
                  <Tabs.Tab value="preview" leftSection={<IconEye size={14} />}>
                    预览
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="edit" pt="md">
                  <Textarea
                    placeholder="请输入商品介绍（支持Markdown格式）&#10;&#10;示例：&#10;**粗体文字**&#10;*斜体文字*&#10;&#10;- 列表项1&#10;- 列表项2"
                    minRows={12}
                    maxRows={20}
                    {...form.getInputProps('description')}
                  />
                  <Text size="xs" c="dimmed" mt="xs">
                    支持Markdown格式：**粗体**、*斜体*、列表等
                  </Text>
                </Tabs.Panel>

                <Tabs.Panel value="preview" pt="md">
                  <div style={{ minHeight: '300px' }}>
                    {renderMarkdownPreview()}
                  </div>
                </Tabs.Panel>
              </Tabs>
            </Stack>

            {/* 租期和价格 */}
            <Group grow>
              <NumberInput
                label="租期（月）"
                placeholder="请输入租期"
                min={1}
                max={120}
                required
                {...form.getInputProps('rental_period')}
              />
              <NumberInput
                label="每月金额（元）"
                placeholder="请输入每月金额"
                min={0.01}
                max={999999.99}
                decimalScale={2}
                required
                {...form.getInputProps('monthly_price')}
              />
              <NumberInput
                label="服务费（元）"
                placeholder="请输入服务费"
                min={0}
                max={999999.99}
                decimalScale={2}
                required
                {...form.getInputProps('service_fee')}
              />
            </Group>

            {/* 启用状态（仅编辑模式显示） */}
            {isEditMode && (
              <Switch
                label="启用商品"
                description="关闭后商品将不可见"
                {...form.getInputProps('is_active', { type: 'checkbox' })}
              />
            )}

            {/* 操作按钮 */}
            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                leftSection={<IconX size={16} />}
                onClick={handleClose}
                disabled={loading}
              >
                取消
              </Button>
              <Button
                type="submit"
                leftSection={<IconDeviceFloppy size={16} />}
                loading={loading}
              >
                {isEditMode ? '更新商品' : '创建商品'}
              </Button>
            </Group>
          </Stack>
        </form>
      </div>
    </Modal>
  );
}
