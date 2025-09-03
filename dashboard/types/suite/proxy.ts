import { BaseModel } from '../common';

// Proxy interface
export interface Proxy extends BaseModel {
  tenant_id: number;
  charge_type: number;
  vendor: string;
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  is_valid: boolean;
  method?: string;
  country?: string;
  region?: string;
  city?: string;
  isp?: string;
  asn?: string;
  colo?: string;
  latency?: number;
  fraud_score?: number;
  external_ip?: string;
  history_external_ips?: any;
  last_checked_at?: Date;
}
