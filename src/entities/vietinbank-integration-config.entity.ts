import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { VietinBankAccount } from './vietinbank-account.entity';

export const VIETINBANK_ENVIRONMENTS = ['UAT', 'PROD'] as const;
export type VietinBankEnvironment = (typeof VIETINBANK_ENVIRONMENTS)[number];

export const VIETINBANK_CONFIG_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type VietinBankConfigStatus =
  (typeof VIETINBANK_CONFIG_STATUSES)[number];

@Entity('vietinbank_integration_configs')
@Index('UQ_vietinbank_config_branch_environment', ['branchId', 'environment'], {
  unique: true,
})
export class VietinBankIntegrationConfig extends BaseEntity {
  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('varchar', { length: 10 })
  environment: VietinBankEnvironment;

  @Column('varchar', { name: 'provider_id', length: 50 })
  providerId: string;

  @Column('varchar', { name: 'merchant_id', length: 50 })
  merchantId: string;

  @Column('varchar', { nullable: true, name: 'product_id', length: 50 })
  productId: string | null;

  @Column('varchar', { nullable: true, name: 'gateway_id', length: 100 })
  gatewayId: string | null;

  @Column('varchar', { nullable: true, length: 100 })
  username: string | null;

  @Column('varchar', { name: 'client_id', length: 255 })
  clientId: string;

  @Column('varchar', { name: 'client_secret_ref', length: 500 })
  clientSecretRef: string;

  @Column('varchar', { name: 'partner_private_key_ref', length: 500 })
  partnerPrivateKeyRef: string;

  @Column('text', { nullable: true, name: 'partner_public_key' })
  partnerPublicKey: string | null;

  @Column('text', { name: 'bank_public_key' })
  bankPublicKey: string;

  @Column('varchar', { name: 'api_base_url', length: 500 })
  apiBaseUrl: string;

  @Column('varchar', { length: 20, default: 'ACTIVE' })
  status: VietinBankConfigStatus;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @OneToMany(() => VietinBankAccount, (account) => account.integrationConfig)
  accounts: VietinBankAccount[];
}
