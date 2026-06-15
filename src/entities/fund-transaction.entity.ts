import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Fund } from './fund.entity';

@Entity('fund_transactions')
export class FundTransaction extends BaseEntity {
  @Column('uuid', { name: 'fund_id' })
  fundId: string;

  @Column('varchar')
  type: string;

  @Column('numeric', { precision: 15, scale: 2 })
  amount: number;

  @Column('numeric', { precision: 15, scale: 2, name: 'balance_after' })
  balanceAfter: number;

  @Column('varchar', { name: 'debit_account_code', nullable: true })
  debitAccountCode: string;

  @Column('varchar', { name: 'credit_account_code', nullable: true })
  creditAccountCode: string;

  @Column('varchar', { name: 'ref_type', nullable: true })
  refType: string;

  @Column('uuid', { name: 'ref_id', nullable: true })
  refId: string;

  @Column('uuid', { name: 'order_id', nullable: true })
  orderId: string;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_id' })
  fund: Fund;
}