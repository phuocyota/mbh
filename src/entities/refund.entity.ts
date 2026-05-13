import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Order } from './order.entity';
import { User } from './user.entity';

@Entity('refunds')
export class Refund extends BaseEntity {
  @Column('uuid', { name: 'order_id' })
  orderId: string;

  @Column('varchar', { unique: true, name: 'refund_code' })
  refundCode: string;

  @Column('numeric', { precision: 12, scale: 2, name: 'refund_amount' })
  refundAmount: number;

  @Column('text', { nullable: true })
  reason: string;

  @Column('varchar', { default: 'PENDING' })
  status: string; // PENDING, APPROVED, REJECTED, COMPLETED

  @Column('uuid', { nullable: true, name: 'approved_by' })
  approvedBy: string;

  @Column('timestamp', { nullable: true, name: 'approved_at' })
  approvedAt: Date;

  @Column('timestamp', { nullable: true, name: 'completed_at' })
  completedAt: Date;

  // Relations
  @ManyToOne(() => Order, (order) => order.refunds)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => User, (user) => user.refunds)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @OneToMany('RefundItem', 'refund', { cascade: true })
  refundItems: any[];
}
