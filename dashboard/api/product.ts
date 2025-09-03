import { request } from './base';

// 商品类型定义
export interface Product {
  id: number;
  name: string;
  cover_image?: string;
  description?: string;
  rental_period: number;
  monthly_price: number;
  service_fee: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductCreateRequest {
  name: string;
  cover_image: string; // 封面图片现在是必填项
  description?: string;
  rental_period: number;
  monthly_price: number;
  service_fee: number;
}

export interface ProductUpdateRequest {
  name?: string;
  cover_image?: string;
  description?: string;
  rental_period?: number;
  monthly_price?: number;
  service_fee?: number;
  is_active?: boolean;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}

// 获取商品列表
export const getProducts = async (params?: ProductListParams): Promise<ProductListResponse> => {
  const searchParams = new URLSearchParams();
  
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.search) searchParams.append('search', params.search);
  if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
  
  const queryString = searchParams.toString();
  const url = queryString ? `/admin/products?${queryString}` : '/admin/products';
  
  return await request<ProductListResponse>({
    url,
    method: 'GET',
  });
};

// 创建商品
export const createProduct = async (data: ProductCreateRequest): Promise<Product> => {
  return await request<Product>({
    url: '/admin/products',
    method: 'POST',
    data,
  });
};

// 获取单个商品详情
export const getProduct = async (id: number): Promise<Product> => {
  return await request<Product>({
    url: `/admin/products/${id}`,
    method: 'GET',
  });
};

// 更新商品
export const updateProduct = async (id: number, data: ProductUpdateRequest): Promise<Product> => {
  return await request<Product>({
    url: `/admin/products/${id}`,
    method: 'PUT',
    data,
  });
};

// 删除商品
export const deleteProduct = async (id: number): Promise<{ message: string }> => {
  return await request<{ message: string }>({
    url: `/admin/products/${id}`,
    method: 'DELETE',
  });
};
