import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Order } from './order.entity';
import { Branch } from './branch.entity';
import { KitchenTicketItem } from './kitchen-ticket-item.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('kitchen_tickets')
export class KitchenTicket extends BaseEntity {
  @Column('uuid', { name: 'order_id' })
  orderId: string;

  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('varchar', { default: 'WAITING' })
  status: string; // WAITING, PREPARING, READY, DELIVERED, CANCELLED

  // Relations
  @ManyToOne(() => Order, (order) => order.kitchenTickets)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Branch, (branch) => branch.kitchenTickets)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @OneToMany(() => KitchenTicketItem, (item) => item.kitchenTicket, {
    cascade: true,
  })
  items: KitchenTicketItem[];
}
