export type AutoRegistrationMethod =
  | 'sol_wallet'
  | 'evm_wallet'
  | 'btc_wallet'
  | 'email_account'
  | 'google_account'
  | 'sui_wallet'
  | 'ton_wallet'
  | 'cosmos_wallet'
  | 'twitter'
  | 'tiktok'
  | 'discord'
  | 'telegram';

export type ColumnValueType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'jwt_token'
  | 'datetime'
  | 'node_is_connected'
  | 'node_id'
  | 'node_is_banned'
  | 'timestamp';

export type AppTaskScheduleType = 'once' | 'per_hour' | 'per_day' | 'per_week' | 'per_month';

export interface AppTaskInputItem {
  key: string;
  display_name: string;
  value_type: ColumnValueType;
  required: boolean;
}

export interface AppTaskDef {
  key: string;
  display_name: string;
  schedule_type: AppTaskScheduleType;
  schedule_unit: number;
  min_delay: number;
  max_delay: number;
  manual_run: boolean;
  runs_on_morelogin: boolean;
  enabled: boolean;
  input_items: Array<AppTaskInputItem>;
  max_concurrent_tasks?: number;
}

export interface App {
  type: 'telegram' | 'ai' | 'others' | 'chain' | 'tropee' | 'depin' | 'gamefi' | 'defin' | 'meme';
  app_key: string;
  label: string;
  icon: string;
  desc: string;
  website: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  airdrop_status?: string;
  referral_code?: string;
  drophunting_link?: string;
  rootdata_link?: string;
  raise_or_funds?: number;
  reward_date?: string;
  is_auto_registration_enabled?: boolean;
  referral_enabled?: boolean;
  requires_registration?: boolean;
  auto_registration_referral_code_required?: boolean;
  auto_registration_by?: AutoRegistrationMethod;
  auto_registration_requirements: Array<{
    type: AutoRegistrationMethod;
    required: boolean;
    requires_private_key: boolean;
    requires_cookies: boolean;
    requires_mfa: boolean;
    requires_app_password: boolean;
    requires_login_in_morelogin: boolean;
  }>;

  is_manual_run_enabled?: boolean;
  manual_run_title?: string;
  table_columns?: TableColumn[];

  has_node_list?: boolean;
  node_columns?: Array<{
    key: string;
    label: string;
    value_expression: string;
    value_type: ColumnValueType;
  }>;
  is_referral_enabled?: boolean;
  has_task_list?: boolean;
  tasks?: Array<AppTaskDef>;
}

export interface AppAccount {
  id: number;
  app_key: string;
  account_id: number;
  social_account_type: string;
  social_account_id: number;
  display_name: string;
  detail_info: Record<string, any>;
  last_refresh_data_at: string;
  last_refresh_data_success: boolean;
  last_refresh_data_err_msg: string;
  k8s_deployment: string;
  created_at: string;
  referral_code?: string;
  referral_by?: string;

  account: {
    id: number;
    display_name: string;
    morelogin_env_id: string;
  };
}

export interface AppTask {
  id: number;
  created_at: string;
  app_key: string;
  app_account_id: number;
  task_key: string;
  next_execution_time: string;
  execution_records: Array<{
    status: 'SUCCESS' | 'FAILED';
    err_msg: string;
    timestamp: string;
  }>;
  account: {
    id: number;
    display_name: string;
  };
}

export interface AppStats {
  display_name: string;
  value: number;
  value_type: ColumnValueType;
  number_unit?: number;
  display_options?: {
    type: 'readable_number';
  };
}

export interface AppRegisterConfig {
  default_referral_code?: string;
  referal_strategy?: string;
  default_referral_code_probability?: number;
  empty_referral_code_probability?: number;
  random_delay_min: number;
  random_delay_max: number;
}

export interface AppRegisterTask {
  id: number;
  created_at: string;
  app_key: string;
  account_id: number;
  status: string;
  err_msg: string;
  start_time: number;
  account: {
    id: number;
    display_name: string;
  };
}

/**
 * Statistics data point
 */
export interface StatisticDataPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Account statistics response
 */
export interface AccountStatistics {
  app_key: string;
  app_account_id: number;
  column_key: string;
  interval_type: 'daily' | 'hourly';
  data: StatisticDataPoint[];
}

/**
 * App aggregate statistics data point with account count
 */
export interface AggregateStatisticDataPoint extends StatisticDataPoint {
  account_count: number;
}

/**
 * App-level aggregate statistics response
 */
export interface AppAggregateStatistics {
  app_key: string;
  column_key: string;
  aggregate_type: 'sum' | 'avg' | 'min' | 'max' | 'count';
  interval_type: 'daily' | 'hourly';
  data: AggregateStatisticDataPoint[];
}

/**
 * Column aggregation type
 */
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';

/**
 * Enhanced table column with aggregation support
 */
export interface TableColumn {
  key: string;
  label: string;
  value_expression: string;
  value_type: ColumnValueType;
  display_options?: {
    type: 'select' | 'readable_number';
  };
  number_unit?: number;
  enable_statistics?: boolean;
  enable_app_aggregation?: boolean;
  aggregation_types?: AggregationType[];
}
