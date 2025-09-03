import { BaseModel } from '../common';
import { WalletSimple } from './wallet';

// Account interface
export interface Account extends BaseModel {
  tenant_id: number;
  email_account: EmailAccountSimple;
  x_account: XAccountSimple;
  discord_account: DiscordAccountSimple;
  morelogin_env_id: string;
  app_types: string[];
  wallets: WalletSimple[];
  time_proxy_id: number;
  proxy_ids: number[];
}

// EmailAccount interface
export interface EmailAccount extends BaseModel {
  tenant_id: number;
  email: string;
  password: string;
  smtp_password?: string;
  recovery_email?: string;
  recovery_email_password?: string;
  is_google: boolean;
  blocked: boolean;
  mfa_secret?: string;
  logged_in_morelogin: boolean;
  last_checked_at?: Date;
}

export interface EmailAccountSimple extends BaseModel {
  email: string;
  blocked: boolean;
  is_google: boolean;
}

// XAccount interface
export interface XAccount {
  tenant_id: number;
  x_user_id?: string;
  username?: string;
  password?: string;
  email?: string;
  email_password?: string;
  login_token?: string;
  registered_at?: Date;
  has_photo: boolean;
  has_bio: boolean;
  can_follow_user: boolean;
  blocked: boolean;
  mfa_secret?: string;
  logged_in_morelogin: boolean;
  last_checked_at?: Date;
}

export interface XAccountSimple {
  username: string;
  blocked: boolean;
}

// DiscordAccount interface
export interface DiscordAccount extends BaseModel {
  tenant_id: number;
  discord_user_id?: string;
  email?: string;
  password?: string;
  email_password?: string;
  login_token?: string;
  registered_at?: Date;
  has_photo: boolean;
  can_join_server: boolean;
  blocked: boolean;
  mfa_secret?: string;
  logged_in_morelogin: boolean;
  last_checked_at?: Date;
}

export interface DiscordAccountSimple {
  email: string;
  blocked: boolean;
}
