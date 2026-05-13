import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Refund } from './refund.entity';
import { OrderItem } from './order-item.entity';

@Entity('refund_items')
export class RefundItem extends BaseEntity {
  @Column('uuid', { name: 'refund_id' })
  refundId: string;

  @Column('uuid', { name: 'order_item_id' })
  orderItemId: string;

  @Column('int')
  quantity: number;

  @Column('numeric', { precision: 12, scale: 2 })
  amount: number;

  // Relations
  @ManyToOne(() => Refund, (refund) => refund.refundItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'refund_id' })
  refund: Refund;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;
}
