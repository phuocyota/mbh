import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { StockTakeItem } from './stock-take-item.entity';

@Entity('stock_takes')
export class StockTake extends BaseEntity {
  @Column('uuid', { name: 'branch_id', default: '00000000-0000-0000-0000-000000000001' })
  branchId: string;

  @Column('varchar', { unique: true })
  code: string;

  @Column('varchar', { default: 'DRAFT' })
  status: string; // DRAFT, COMPLETED, CANCELLED

  @Column('timestamp', { name: 'counted_at', nullable: true })
  countedAt: Date;

  @Column('numeric', { precision: 15, scale: 2, name: 'total_difference_amount', default: 0 })
  totalDifferenceAmount: number;

  @Column('numeric', { precision: 12, scale: 2, name: 'increase_quantity', default: 0 })
  increaseQuantity: number;

  @Column('numeric', { precision: 12, scale: 2, name: 'decrease_quantity', default: 0 })
  decreaseQuantity: number;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @OneToMany(() => StockTakeItem, (item) => item.stockTake, { cascade: true })
  items: StockTakeItem[];
}
