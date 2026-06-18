import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('stock_takes')
export class StockTake extends BaseEntity {
  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('varchar', { unique: true })
  code: string;

  @Column('varchar', { default: 'DRAFT' })
  status: string; // DRAFT, COMPLETED, CANCELLED

  @Column('timestamp', { name: 'counted_at', nullable: true })
  countedAt: Date;

  @Column('numeric', {
    precision: 15,
    scale: 2,
    default: 0,
    name: 'total_difference_amount',
  })
  totalDifferenceAmount: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    default: 0,
    name: 'increase_quantity',
  })
  increaseQuantity: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    default: 0,
    name: 'decrease_quantity',
  })
  decreaseQuantity: number;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @OneToMany('StockTakeItem', 'stockTake', { cascade: true })
  items: any[];
}
