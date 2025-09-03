import { request } from './base';

// 用户类型定义
export interface User {
  id: number;
  alipay_open_id?: string;
  nickname?: string;
  avatar_url?: string;
  phone?: string;
  is_certified: boolean;
  id_card_number?: string;
  id_card_name?: string;
  contact_address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  email?: string;
  social_account?: string;
  created_at?: string;
  updated_at?: string;
}

// 用户更新请求
export interface UserUpdateRequest {
  nickname?: string;
  phone?: string;
  is_certified?: boolean;
  id_card_number?: string;
  id_card_name?: string;
  contact_address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  email?: string;
  social_account?: string;
}

// 用户列表响应
export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// 用户列表查询参数
export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  is_certified?: boolean;
}

// 获取用户列表（管理员）
export const getUsers = async (params?: UserListParams): Promise<UserListResponse> => {
  const searchParams = new URLSearchParams();
  
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.search) searchParams.append('search', params.search);
  if (params?.is_certified !== undefined) searchParams.append('is_certified', params.is_certified.toString());
  
  const queryString = searchParams.toString();
  const url = queryString ? `/admin/users?${queryString}` : '/admin/users';
  
  return await request<UserListResponse>({
    url,
    method: 'GET',
  });
};

// 获取单个用户详情（管理员）
export const getUser = async (id: number): Promise<User> => {
  return await request<User>({
    url: `/admin/users/${id}`,
    method: 'GET',
  });
};

// 更新用户信息（管理员）
export const updateUser = async (id: number, data: UserUpdateRequest): Promise<User> => {
  return await request<User>({
    url: `/admin/users/${id}`,
    method: 'PUT',
    data,
  });
};

// 获取用户的订单列表（管理员）
export const getUserOrders = async (
  userId: number, 
  params?: { page?: number; limit?: number }
): Promise<import('./order').OrderListResponse> => {
  const searchParams = new URLSearchParams();
  
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  
  const queryString = searchParams.toString();
  const url = queryString ? `/admin/users/${userId}/orders?${queryString}` : `/admin/users/${userId}/orders`;
  
  return await request<import('./order').OrderListResponse>({
    url,
    method: 'GET',
  });
};