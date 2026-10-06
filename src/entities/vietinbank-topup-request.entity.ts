import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Customer } from './customer.entity';
import { Branch } from './branch.entity';
import { VietinBankAccount } from './vietinbank-account.entity';
import { VietinBankIntegrationConfig } from './vietinbank-integration-config.entity';

export const VIETINBANK_TOPUP_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type VietinBankTopupStatus =
  (typeof VIETINBANK_TOPUP_STATUS)[keyof typeof VIETINBANK_TOPUP_STATUS];

@Entity('vietinbank_topup_requests')
@Index('IDX_vietinbank_topup_customer_status', ['customerId', 'status'])
export class VietinBankTopupRequest extends BaseEntity {
  @Column('uuid', { unique: true, name: 'request_id' })
  requestId: string;

  @Column('varchar', { unique: true, name: 'payment_code', length: 32 })
  paymentCode: string;

  @Column('uuid', { name: 'customer_id' })
  customerId: string;

  @Column('uuid', { nullable: true, name: 'branch_id' })
  branchId: string | null;

  @Column('uuid', { nullable: true, name: 'vietinbank_config_id' })
  vietinBankConfigId: string | null;

  @Column('uuid', { nullable: true, name: 'vietinbank_account_id' })
  vietinBankAccountId: string | null;

  @Column('numeric', { precision: 12, scale: 2, name: 'balance_at_creation' })
  balanceAtCreation: number;

  @Column('numeric', { precision: 12, scale: 2, name: 'target_balance' })
  targetBalance: number;

  @Column('numeric', { precision: 12, scale: 2 })
  amount: number;

  @Column('text', { nullable: true, name: 'qr_content' })
  qrContent: string | null;

  @Column('text', { nullable: true, name: 'qr_base64' })
  qrBase64: string | null;

  @Column('varchar', { name: 'bank_account_number', length: 64 })
  bankAccountNumber: string;

  @Column('varchar', { name: 'bank_account_name', length: 255 })
  bankAccountName: string;

  @Column('varchar', { length: 32, default: VIETINBANK_TOPUP_STATUS.PENDING })
  status: VietinBankTopupStatus;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  @Column('timestamptz', { nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column('text', { nullable: true, name: 'failure_reason' })
  failureReason: string | null;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @ManyToOne(() => VietinBankIntegrationConfig, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vietinbank_config_id' })
  vietinBankConfig: VietinBankIntegrationConfig | null;

  @ManyToOne(() => VietinBankAccount, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vietinbank_account_id' })
  vietinBankAccount: VietinBankAccount | null;
}
