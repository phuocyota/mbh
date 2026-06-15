import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('funds')
export class Fund extends BaseEntity {
  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('varchar', { unique: true })
  code: string;

  @Column('varchar')
  name: string;

  @Column('varchar', { name: 'account_code' })
  accountCode: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  balance: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  debit: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  credit: number;

  @Column('varchar', { default: 'active' })
  status: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;
}
