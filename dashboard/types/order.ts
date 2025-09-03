export interface Order {
  id: string;
  orderNo: string;
  userId: string;
  title: string;
  orderStatus: string;
  outOrderNo: string;
  channel: string;
  paymentId?: string;
  paymentStatus?: string;
  paymentTime?: string;
  paymentMethod?: string;
  customerName?: string;
  productId?: string;
  productNum?: number;
  totalAmount?: number;
  discountAmount?: number;
  actualAmount?: number;
  currency?: string;
  totalPoint?: number;
  remark?: string;
  updatedAt?: string;
  createdAt: string;
  
  // 关联用户信息
  user?: {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
}

export interface GetOrdersParams {
  page?: number;
  limit?: number;
  search?: string;
  paymentStatus?: string;
  orderStatus?: string;
  startDate?: string;
  endDate?: string;
}

export interface GetOrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
} 