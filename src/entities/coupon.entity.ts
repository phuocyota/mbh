import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Customer } from './customer.entity';
import { Order } from './order.entity';

@Entity('coupons')
export class Coupon extends BaseEntity {
  @Column('uuid', { name: 'customer_id' })
  customerId: string;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    name: 'reduce_price',
  })
  reducePrice: number;

  @Column('integer', { default: 1 })
  quantity: number;

  @Column('integer', { default: 0, name: 'used_quantity' })
  usedQuantity: number;

  @Column('varchar', { default: 'ACTIVE' })
  status: string; // ACTIVE, EXPIRED, USED

  @Column('timestamp', { nullable: true, name: 'expires_at' })
  expiresAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.coupons)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany('Order', 'coupon')
  orders: Order[];
}
