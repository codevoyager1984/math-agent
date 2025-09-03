import { User } from '@/types/user';
import { request } from './base';

export const getAccountProfile = async (): Promise<User> => {
  return await request<User>({
    url: '/auth/profile',
    method: 'GET',
  });
};

export const login = async (
  email: string,
  password: string
): Promise<{
  success: boolean;
  access_token: string;
}> => {
  return await request({
    url: '/auth/login',
    method: 'POST',
    data: { email, password },
  });
};

export const exchangeCodeForToken = async (
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  user?: User;
}> => {
  return await request({
    url: '/auth/oidc/callback',
    method: 'POST',
    data: {
      code,
      redirect_uri: redirectUri,
    },
  });
};

// 管理员登录
export const adminLogin = async (
  username: string,
  password: string
): Promise<{
  access_token: string;
  user: {
    id: number;
    username: string;
    email?: string;
    is_active: boolean;
    is_superuser: boolean;
  };
}> => {
  return await request({
    url: '/admin/login',
    method: 'POST',
    data: { username, password },
  });
};

// 获取管理员用户信息
export const getAdminProfile = async (): Promise<{
  id: number;
  username: string;
  email?: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at?: string;
  updated_at?: string;
}> => {
  return await request({
    url: '/admin/profile',
    method: 'GET',
  });
};
