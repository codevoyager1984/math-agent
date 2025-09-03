import { BaseModel } from '../common';

export interface Wallet extends BaseModel {
  tenant_id: number;
  account_id: number;
  chain: string;
  address: string;
  private_key: string;
  mnemonic: string;
}

export interface WalletSimple {
  chain: string;
  address: string;
}
