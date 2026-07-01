import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { COMMON_STATUS } from '../common/constant/constant';
import { Customer } from './customer.entity';
import { MealItem } from './meal-item.entity';

@Entity('customer_meal_items')
export class CustomerMealItem extends BaseEntity {
  @Column('uuid', { name: 'customer_id' })
  customerId: string;

  @Column('uuid', { name: 'meal_item_id' })
  mealItemId: string;

  @Column('int', { default: 1 })
  quantity: number;

  @Column('varchar', { default: COMMON_STATUS.ACTIVE })
  status: string;

  @Column('text', { nullable: true })
  note?: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => MealItem)
  @JoinColumn({ name: 'meal_item_id' })
  mealItem: MealItem;
}
