import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Product } from './product.entity';
import { Branch } from './branch.entity';
import { COMMON_STATUS } from '../common/constant/constant';

@Entity('meal_items')
export class MealItem extends BaseEntity {
  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('varchar', { name: 'meal_period' })
  mealPeriod: string; // BREAKFAST, LUNCH, AFTERNOON, DINNER

  @Column('varchar', { default: 'primary' })
  level: string;

  @Column('int', { nullable: true, name: 'day_of_week' })
  dayOfWeek?: number;

  @Column('varchar', { nullable: true, name: 'date_key' })
  dateKey?: string;

  @Column('int', { default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column('varchar', { default: COMMON_STATUS.ACTIVE })
  status: string;

  @Column('text', { nullable: true })
  note?: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => Product, (product) => product.mealItems)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
