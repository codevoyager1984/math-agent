import { request } from './base';

export interface SystemConfig {
  id: number;
  key: string;
  value: string | null;
  description: string | null;
  category: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SystemConfigBatchUpdateRequest {
  contact_info?: string;
  business_hours?: string;
  location_text?: string;
  location_latitude?: string;
  location_longitude?: string;
  about_us?: string;
}

export interface SystemConfigUpdateRequest {
  value: string;
  description?: string;
  category?: string;
}

export interface SystemConfigsResponse {
  contact_info: SystemConfig | null;
  business_hours: SystemConfig | null;
  location_text: SystemConfig | null;
  location_latitude: SystemConfig | null;
  location_longitude: SystemConfig | null;
  about_us: SystemConfig | null;
}

// 获取所有系统配置
export const getSystemConfigs = async (): Promise<SystemConfigsResponse> => {
  return request<SystemConfigsResponse>({
    url: '/admin/system-configs',
    method: 'GET',
  });
};

// 批量更新系统配置
export const batchUpdateSystemConfigs = async (
  data: SystemConfigBatchUpdateRequest
): Promise<{ message: string }> => {
  return request<{ message: string }>({
    url: '/admin/system-configs/batch',
    method: 'PUT',
    data,
  });
};

// 根据键获取单个系统配置
export const getSystemConfigByKey = async (key: string): Promise<SystemConfig> => {
  return request<SystemConfig>({
    url: `/admin/system-configs/${key}`,
    method: 'GET',
  });
};

// 更新单个系统配置
export const updateSystemConfig = async (
  key: string,
  data: SystemConfigUpdateRequest
): Promise<SystemConfig> => {
  return request<SystemConfig>({
    url: `/admin/system-configs/${key}`,
    method: 'PUT',
    data,
  });
};

// 删除系统配置
export const deleteSystemConfig = async (key: string): Promise<{ message: string }> => {
  return request<{ message: string }>({
    url: `/admin/system-configs/${key}`,
    method: 'DELETE',
  });
};