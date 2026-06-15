import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Fund } from './fund.entity';
import { Order } from './order.entity';
import { Supplier } from './supplier.entity';

@Entity('money_vouchers')
export class MoneyVoucher extends BaseEntity {
  @Column('varchar', { unique: true })
  code: string;

  @Column('varchar')
  type: string;

  @Column('uuid', { name: 'fund_id' })
  fundId: string;

  @Column('numeric', { precision: 15, scale: 2 })
  amount: number;

  @Column('uuid', { name: 'order_id', nullable: true })
  orderId: string;

  @Column('uuid', { name: 'supplier_id', nullable: true })
  supplierId: string;

  @Column('varchar', { nullable: true })
  purpose: string;

  @Column('varchar', { name: 'debit_account_code', nullable: true })
  debitAccountCode: string;

  @Column('varchar', { name: 'credit_account_code', nullable: true })
  creditAccountCode: string;

  @Column('varchar', { name: 'ref_type', nullable: true })
  refType: string;

  @Column('uuid', { name: 'ref_id', nullable: true })
  refId: string;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_id' })
  fund: Fund;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}