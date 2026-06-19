import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Product } from './product.entity';
import { Branch } from './branch.entity';
import { Supplier } from './supplier.entity';
import { Order } from './order.entity';
import { Fund } from './fund.entity';
import { MoneyVoucher } from './money-voucher.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('stock_receipt_detail')
export class StockReceiptDetail extends BaseEntity {
  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('uuid', { name: 'supplier_id', nullable: true })
  supplierId: string;

  @Column('uuid', { name: 'order_id', nullable: true })
  orderId: string;

  @Column('uuid', { name: 'fund_id', nullable: true })
  fundId: string;

  @Column('uuid', { name: 'money_voucher_id', nullable: true })
  moneyVoucherId: string;

  @Column('numeric', { precision: 12, scale: 2 })
  quantity: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'unit_price' })
  unitPrice: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column('varchar')
  type: string; // IMPORT, EXPORT, TRANSFER

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_id' })
  fund: Fund;

  @ManyToOne(() => MoneyVoucher)
  @JoinColumn({ name: 'money_voucher_id' })
  moneyVoucher: MoneyVoucher;
}
