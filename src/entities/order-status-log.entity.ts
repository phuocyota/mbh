import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Order } from './order.entity';

@Entity('order_status_logs')
export class OrderStatusLog extends BaseEntity {
  @Column('uuid', { name: 'order_id' })
  orderId: string;

  @Column('int', { nullable: true, name: 'old_status' })
  oldStatus: number | null;

  @Column('int', { name: 'new_status' })
  newStatus: number;

  @Column('varchar', { nullable: true, name: 'changed_by' })
  changedBy: string | null;

  @Column('text', { nullable: true })
  reason: string | null;

  @ManyToOne(() => Order, (order) => order.statusLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
