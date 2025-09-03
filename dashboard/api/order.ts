import { request } from './base';

// 订单分期类型定义
export interface OrderInstallment {
  id: number;
  installment_no: number;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: string;
  payment_method?: string;
  transaction_id?: string;
  remark?: string;
  created_at?: string;
  out_trade_no?: string;
  trade_no?: string;
}

// 订单类型定义
export interface Order {
  id: number;
  user_id: number;
  product_id: number;
  order_no: string;
  product_name: string;
  product_cover_image?: string;
  rental_period: number;
  monthly_price: number;
  total_amount: number;
  status: string;
  service_fee_paid: boolean;
  service_fee_amount?: number;
  service_fee_paid_date?: string;
  service_fee_trade_no?: string;
  service_fee_out_trade_no?: string;
  sign_flow_id?: string;
  sign_url?: string;
  sign_status?: string;
  rental_start_date?: string;
  rental_end_date?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
  user_real_name?: string;
  user_nickname?: string;
  user_phone?: string;
  // 审核图片字段
  rencheheyi_image?: string;
  chejiahao_image?: string;
  zhimaxinyong_image?: string;
  installments: OrderInstallment[];
}

// 订单创建请求
export interface OrderCreateRequest {
  product_id: number;
  user_id: number;
  remark?: string;
}

// 订单列表响应
export interface OrderListResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// 订单列表查询参数
export interface OrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  user_id?: number;
}

// 订单统计数据
export interface OrderStatistics {
  total_orders: number;
  status_counts: {
    pending: number;
    under_review: number;
    paid: number;
    cancelled: number;
    completed: number;
    inprogress: number;
    rejected: number;
  };
  overdue_installments: number;
  overdue_orders: number;
  today_orders: number;
  month_orders: number;
  pending_orders: number;
  total_revenue: number;
}

// 获取订单列表（管理员）
export const getOrders = async (params?: OrderListParams): Promise<OrderListResponse> => {
  const searchParams = new URLSearchParams();
  
  if (params?.page) searchParams.append('page', params.page.toString());
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.search) searchParams.append('search', params.search);
  if (params?.status) searchParams.append('status', params.status);
  if (params?.user_id) searchParams.append('user_id', params.user_id.toString());
  
  const queryString = searchParams.toString();
  const url = queryString ? `/admin/orders?${queryString}` : '/admin/orders';
  
  return await request<OrderListResponse>({
    url,
    method: 'GET',
  });
};

// 创建订单
export const createOrder = async (data: OrderCreateRequest): Promise<Order> => {
  return await request<Order>({
    url: '/orders',
    method: 'POST',
    data,
  });
};

// 获取单个订单详情（管理员）
export const getOrder = async (id: number): Promise<Order> => {
  return await request<Order>({
    url: `/admin/orders/${id}`,
    method: 'GET',
  });
};

// 更新订单状态（管理员）
export const updateOrderStatus = async (id: number, status: string): Promise<{ message: string }> => {
  return await request<{ message: string }>({
    url: `/admin/orders/${id}/status?status=${status}`,
    method: 'PUT',
  });
};

// 取消订单
export const cancelOrder = async (id: number): Promise<{ message: string }> => {
  return await request<{ message: string }>({
    url: `/orders/${id}/cancel`,
    method: 'PUT',
  });
};

// 标记分期为已付款（管理员）
export const markInstallmentPaid = async (
  installmentId: number, 
  paymentData?: { payment_method?: string; transaction_id?: string }
): Promise<{ message: string }> => {
  const searchParams = new URLSearchParams();
  if (paymentData?.payment_method) searchParams.append('payment_method', paymentData.payment_method);
  if (paymentData?.transaction_id) searchParams.append('transaction_id', paymentData.transaction_id);
  
  const queryString = searchParams.toString();
  const url = queryString ? `/admin/installments/${installmentId}/pay?${queryString}` : `/admin/installments/${installmentId}/pay`;
  
  return await request<{ message: string }>({
    url,
    method: 'PUT',
  });
};

// 获取订单统计数据（管理员）
export const getOrderStatistics = async (): Promise<OrderStatistics> => {
  return await request<OrderStatistics>({
    url: '/admin/orders/statistics',
    method: 'GET',
  });
};

// 归还资产请求参数
export interface ReturnAssetRequest {
  pending_amount: number;
}

// 归还资产（管理员）
export const returnAsset = async (orderId: number, data: ReturnAssetRequest): Promise<{ message: string }> => {
  return await request<{ message: string }>({
    url: `/admin/orders/${orderId}/return-asset`,
    method: 'PUT',
    data,
  });
};

// 分期更新请求参数
export interface InstallmentUpdateRequest {
  status?: string;
  amount?: number;
  payment_method?: string;
}

// 更新分期详情（管理员）
export const updateInstallment = async (
  installmentId: number, 
  data: InstallmentUpdateRequest
): Promise<{ message: string }> => {
  return await request<{ message: string }>({
    url: `/admin/installments/${installmentId}`,
    method: 'PUT',
    data,
  });
};

// 审核订单请求参数
export interface ReviewOrderRequest {
  action: 'approve' | 'reject';
  remark?: string;
}

// 审核订单（管理员）
export const reviewOrder = async (
  orderId: number, 
  data: ReviewOrderRequest
): Promise<{ message: string }> => {
  return await request<{ message: string }>({
    url: `/admin/orders/${orderId}/review`,
    method: 'PUT',
    data,
  });
};