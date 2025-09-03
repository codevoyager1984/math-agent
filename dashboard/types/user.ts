export interface LocationInfo {
  ip_address?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface TokenUsageStats {
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  request_count: number;
}

export interface PaymentStats {
  total_orders: number;
  total_amount: number;
  first_payment_time?: string;
  last_payment_time?: string;
}

export interface InviteStats {
  total_invited: number; // 总邀请用户数（成功绑定邀请码的用户数）
}

export interface User {
  id: string;
  authing_user_id?: string;
  name?: string;
  givenName?: string;
  picture?: string;
  email?: string;
  phone_number?: string;
  connected_invite_code?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  createdAt?: string;
  connectedInviteCodeAt?: string;
  subDomain?: string;
  set_default_browser?: boolean;
  location?: LocationInfo;
  token_usage?: TokenUsageStats;
  payment_stats?: PaymentStats;
  user_points?: {
    userId: string;
    availablePoint: number;
    usedPoint: number;
    totalPoint: number;
  };
  invite_stats?: InviteStats;
}
