import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { Supplier } from './supplier.entity';
import { Order } from './order.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('warehouse_vouchers')
export class WarehouseVoucher extends BaseEntity {
  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('varchar', { unique: true })
  code: string;

  @Column('varchar')
  type: string;

  @Column('uuid', { name: 'supplier_id', nullable: true })
  supplierId: string;

  @Column('uuid', { name: 'order_id', nullable: true })
  orderId: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column('uuid', { name: 'fund_id', nullable: true })
  fundId: string;

  @Column('uuid', { name: 'money_voucher_id', nullable: true })
  moneyVoucherId: string;

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

  @OneToMany('WarehouseVoucherItem', 'voucher', { cascade: true })
  items: any[];
}
