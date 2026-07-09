import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { Fund } from './fund.entity';
import { FundDetail } from './fund-detail.entity';
import { Order } from './order.entity';
import { MoneyVoucher } from './money-voucher.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('fund_receipt_paid')
export class FundReceiptPaid extends BaseEntity {
  @Column('varchar', { unique: true })
  code: string;

  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column('uuid', { name: 'fund_id' })
  fundId: string;

  @Column('uuid', { name: 'order_id', nullable: true })
  orderId: string;

  @Column('uuid', { name: 'money_voucher_id', nullable: true })
  moneyVoucherId: string;

  @Column('varchar', { default: 'COMPLETED' })
  status: string; // DRAFT, COMPLETED, CANCELLED

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_id' })
  fund: Fund;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => MoneyVoucher, { nullable: true })
  @JoinColumn({ name: 'money_voucher_id' })
  moneyVoucher: MoneyVoucher;

  @OneToMany(() => FundDetail, (detail) => detail.paidReceipt, { cascade: true })
  details: FundDetail[];
}
