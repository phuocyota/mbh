import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Fund } from './fund.entity';
import { FundDetail } from './fund-detail.entity';

@Entity('fund_receipt_transfer')
export class FundReceiptTransfer extends BaseEntity {
  @Column('varchar', { unique: true })
  code: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column('uuid', { name: 'from_fund_id' })
  fromFundId: string;

  @Column('uuid', { name: 'to_fund_id' })
  toFundId: string;

  @Column('varchar', { default: 'COMPLETED' })
  status: string; // DRAFT, COMPLETED, CANCELLED

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'from_fund_id' })
  fromFund: Fund;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'to_fund_id' })
  toFund: Fund;

  @OneToMany(() => FundDetail, (detail) => detail.transferReceipt, { cascade: true })
  details: FundDetail[];
}
