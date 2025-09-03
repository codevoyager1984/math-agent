'use client';

import React, { useState, useEffect } from 'react';
import {
  Container,
  Stack,
  Title,
  Group,
  Button,
  TextInput,
  Textarea,
  Card,
  LoadingOverlay,
  Text,
  NumberInput,
  Divider,
} from '@mantine/core';
import { IconSettings, IconDeviceFloppy, IconRefresh } from '@tabler/icons-react';
import { toast } from 'sonner';
import { useForm } from '@mantine/form';
import { 
  getSystemConfigs, 
  batchUpdateSystemConfigs,
  SystemConfigsResponse,
  SystemConfigBatchUpdateRequest 
} from '@/api/system-config';
import PageHeader from '@/components/PageHeader/PageHeader';

interface SystemConfigForm {
  contact_info: string;
  business_hours: string;
  location_text: string;
  location_latitude: string;
  location_longitude: string;
  about_us: string;
}

function SystemConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<SystemConfigForm>({
    initialValues: {
      contact_info: '',
      business_hours: '',
      location_text: '',
      location_latitude: '',
      location_longitude: '',
      about_us: '',
    },
  });

  // 获取系统配置
  const fetchSystemConfigs = async () => {
    try {
      setLoading(true);
      const response = await getSystemConfigs();
      
      // 设置表单值
      form.setValues({
        contact_info: response.contact_info?.value || '',
        business_hours: response.business_hours?.value || '',
        location_text: response.location_text?.value || '',
        location_latitude: response.location_latitude?.value || '',
        location_longitude: response.location_longitude?.value || '',
        about_us: response.about_us?.value || '',
      });
    } catch (error) {
      console.error('获取系统配置失败:', error);
      toast.error('获取系统配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchSystemConfigs();
  }, []);

  // 保存配置
  const handleSave = async (values: SystemConfigForm) => {
    try {
      setSaving(true);
      
      // 构建更新请求数据
      const updateData: SystemConfigBatchUpdateRequest = {};
      
      // 只传递有值的字段
      if (values.contact_info.trim()) {
        updateData.contact_info = values.contact_info.trim();
      }
      if (values.business_hours.trim()) {
        updateData.business_hours = values.business_hours.trim();
      }
      if (values.location_text.trim()) {
        updateData.location_text = values.location_text.trim();
      }
      if (values.location_latitude.trim()) {
        updateData.location_latitude = values.location_latitude.trim();
      }
      if (values.location_longitude.trim()) {
        updateData.location_longitude = values.location_longitude.trim();
      }
      if (values.about_us.trim()) {
        updateData.about_us = values.about_us.trim();
      }

      await batchUpdateSystemConfigs(updateData);
      toast.success('系统配置保存成功');
      
      // 重新获取最新配置
      await fetchSystemConfigs();
    } catch (error) {
      console.error('保存系统配置失败:', error);
      toast.error('保存系统配置失败');
    } finally {
      setSaving(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    fetchSystemConfigs();
  };

  // 验证经纬度格式
  const validateCoordinate = (value: string, type: 'latitude' | 'longitude') => {
    if (!value.trim()) return null;
    
    const num = parseFloat(value);
    if (isNaN(num)) {
      return `${type === 'latitude' ? '纬度' : '经度'}必须是有效的数字`;
    }
    
    if (type === 'latitude' && (num < -90 || num > 90)) {
      return '纬度必须在 -90 到 90 之间';
    }
    
    if (type === 'longitude' && (num < -180 || num > 180)) {
      return '经度必须在 -180 到 180 之间';
    }
    
    return null;
  };

  return (
    <Container fluid>
      <Stack gap="lg">
        <PageHeader title="系统配置" />

        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack gap="lg">
            {/* 联系方式配置 */}
            <Card withBorder>
              <div style={{ position: 'relative' }}>
                <LoadingOverlay visible={loading} />
                <Stack gap="md">
                  <Group gap="sm">
                    <IconSettings size={20} />
                    <Title order={3}>联系方式</Title>
                  </Group>
                  <Divider />
                  
                  <TextInput
                    label="联系方式"
                    placeholder="请输入联系方式，如电话、邮箱等"
                    description="客户可以通过此方式联系到您"
                    {...form.getInputProps('contact_info')}
                  />
                </Stack>
              </div>
            </Card>

            {/* 营业时间配置 */}
            <Card withBorder>
              <Stack gap="md">
                <Group gap="sm">
                  <IconSettings size={20} />
                  <Title order={3}>营业时间</Title>
                </Group>
                <Divider />
                
                <TextInput
                  label="营业时间"
                  placeholder="请输入营业时间，如：周一至周日 9:00-18:00"
                  description="向客户展示您的服务时间"
                  {...form.getInputProps('business_hours')}
                />
              </Stack>
            </Card>

            {/* 地理位置配置 */}
            <Card withBorder>
              <Stack gap="md">
                <Group gap="sm">
                  <IconSettings size={20} />
                  <Title order={3}>地理位置</Title>
                </Group>
                <Divider />
                
                <TextInput
                  label="位置描述"
                  placeholder="请输入位置描述，如：北京市朝阳区xxx街道xxx号"
                  description="向客户展示您的地理位置信息"
                  {...form.getInputProps('location_text')}
                />
                
                <Group grow>
                  <TextInput
                    label="纬度"
                    placeholder="如：39.9042"
                    description="纬度坐标 (-90 到 90)"
                    {...form.getInputProps('location_latitude')}
                    error={validateCoordinate(form.values.location_latitude, 'latitude')}
                  />
                  <TextInput
                    label="经度"
                    placeholder="如：116.4074"
                    description="经度坐标 (-180 到 180)"
                    {...form.getInputProps('location_longitude')}
                    error={validateCoordinate(form.values.location_longitude, 'longitude')}
                  />
                </Group>
              </Stack>
            </Card>

            {/* 关于我们配置 */}
            <Card withBorder>
              <Stack gap="md">
                <Group gap="sm">
                  <IconSettings size={20} />
                  <Title order={3}>关于我们</Title>
                </Group>
                <Divider />
                
                <Textarea
                  label="关于我们"
                  placeholder="请输入关于我们的介绍，可以包括公司简介、服务理念等"
                  description="向客户展示您的公司信息和服务理念"
                  rows={6}
                  {...form.getInputProps('about_us')}
                />
              </Stack>
            </Card>

            {/* 操作按钮 */}
            <Group justify="flex-end" gap="md">
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={handleReset}
                disabled={loading || saving}
              >
                重置
              </Button>
              <Button
                type="submit"
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saving}
                disabled={loading}
              >
                保存配置
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Container>
  );
}

export default SystemConfigPage;
