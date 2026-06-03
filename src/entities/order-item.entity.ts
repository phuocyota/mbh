import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Order } from './order.entity';
import { ORDER_ITEM_STATUS } from '../common/constant/constant';

@Entity('order_items')
export class OrderItem extends BaseEntity {
  @Column('uuid', { name: 'order_id' })
  orderId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('varchar', { name: 'product_name' })
  productName: string;

  @Column('numeric', { precision: 12, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column('int')
  quantity: number;

  @Column('numeric', { precision: 12, scale: 2 })
  subtotal: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    default: 0,
    name: 'discount_amount',
  })
  discountAmount: number;

  @Column('numeric', { precision: 12, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column('varchar', { default: ORDER_ITEM_STATUS.NORMAL })
  status: string; // NORMAL, CANCELLED, REFUNDED

  @Column('text', { nullable: true })
  note: string;

  // Relations
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne('Product')
  @JoinColumn({ name: 'product_id' })
  product: any;
}
