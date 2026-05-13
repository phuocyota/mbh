import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { KitchenTicket } from './kitchen-ticket.entity';
import { OrderItem } from './order-item.entity';

@Entity('kitchen_ticket_items')
export class KitchenTicketItem extends BaseEntity {
  @Column('uuid', { name: 'kitchen_ticket_id' })
  kitchenTicketId: string;

  @Column('uuid', { name: 'order_item_id' })
  orderItemId: string;

  @Column('varchar', { name: 'product_name' })
  productName: string;

  @Column('int')
  quantity: number;

  @Column('varchar', { default: 'WAITING' })
  status: string; // WAITING, DONE, CANCELLED

  // Relations
  @ManyToOne(() => KitchenTicket, (kt) => kt.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kitchen_ticket_id' })
  kitchenTicket: KitchenTicket;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;
}
