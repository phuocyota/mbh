import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { VietinBankIntegrationConfig } from './vietinbank-integration-config.entity';

export const VIETINBANK_ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type VietinBankAccountStatus =
  (typeof VIETINBANK_ACCOUNT_STATUSES)[number];

@Entity('vietinbank_accounts')
@Index('IDX_vietinbank_account_config', ['integrationConfigId'])
export class VietinBankAccount extends BaseEntity {
  @Column('uuid', { name: 'integration_config_id' })
  integrationConfigId: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('varchar', { name: 'account_number', length: 100 })
  accountNumber: string;

  @Column('varchar', { nullable: true, name: 'account_name', length: 255 })
  accountName: string | null;

  @Column('varchar', { nullable: true, name: 'account_type', length: 50 })
  accountType: string | null;

  @Column('int', { default: 0 })
  priority: number;

  @Column('boolean', { name: 'is_default', default: false })
  isDefault: boolean;

  @Column('varchar', { length: 20, default: 'ACTIVE' })
  status: VietinBankAccountStatus;

  @ManyToOne(() => VietinBankIntegrationConfig, (config) => config.accounts, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'integration_config_id' })
  integrationConfig: VietinBankIntegrationConfig;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;
}
