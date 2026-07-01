import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { Supplier } from './supplier.entity';
import { Order } from './order.entity';
import { StockReceiptDetail } from './stock-receipt-detail.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('stock_receipt_import')
export class StockReceiptImport extends BaseEntity {
  @Column('varchar', { unique: true })
  code: string;

  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('uuid', { name: 'supplier_id', nullable: true })
  supplierId: string;

  @Column('uuid', { name: 'order_id', nullable: true })
  orderId: string;

  @Column('varchar', { name: 'reason_code', nullable: true })
  reasonCode: string;

  @Column('varchar', { name: 'payment_status', nullable: true })
  paymentStatus: string; // PAID, DEBT

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column('varchar', { default: 'COMPLETED' })
  status: string; // DRAFT, COMPLETED, CANCELLED

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @OneToMany(() => StockReceiptDetail, (detail) => detail.importReceipt, { cascade: true })
  details: StockReceiptDetail[];
}

