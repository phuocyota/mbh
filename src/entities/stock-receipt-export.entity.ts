import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { Order } from './order.entity';
import { Fund } from './fund.entity';
import { MoneyVoucher } from './money-voucher.entity';
import { StockReceiptDetail } from './stock-receipt-detail.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('stock_receipt_export')
export class StockReceiptExport extends BaseEntity {
  @Column('varchar', { unique: true })
  code: string;

  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('uuid', { name: 'order_id', nullable: true })
  orderId: string;

  @Column('uuid', { name: 'fund_id', nullable: true })
  fundId: string;

  @Column('uuid', { name: 'money_voucher_id', nullable: true })
  moneyVoucherId: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column('varchar', { default: 'COMPLETED' })
  status: string; // DRAFT, COMPLETED, CANCELLED

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_id' })
  fund: Fund;

  @ManyToOne(() => MoneyVoucher)
  @JoinColumn({ name: 'money_voucher_id' })
  moneyVoucher: MoneyVoucher;

  @OneToMany(() => StockReceiptDetail, (detail) => detail.exportReceipt, { cascade: true })
  details: StockReceiptDetail[];
}
