import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Category } from './category.entity';
import { ProductPriceHistory } from './product-price-history.entity';
import { MealItem } from './meal-item.entity';
import { Branch } from './branch.entity';

@Entity('products')
@Unique('UQ_products_code_branch_id', ['code', 'branchId'])
export class Product extends BaseEntity {
  @Column('uuid', { name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column('uuid', { name: 'category_id' })
  categoryId: string;

  @Column('varchar', { nullable: true })
  code: string | null;

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true })
  ingredients: string | null;

  @Column('text', { nullable: true, name: 'image_url' })
  imageUrl: string;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  price: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'cost_price',
  })
  costPrice: number;

  @Column('varchar', { nullable: true })
  unit: string; // phần, ly, cái, hộp

  @Column('boolean', { default: true, name: 'is_active' })
  isActive: boolean;

  @Column('boolean', { default: true, name: 'is_canteen_item' })
  isCanteenItem: boolean;

  // Relations
  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ManyToOne(() => Branch, (branch) => branch.products, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @OneToMany(() => ProductPriceHistory, (history) => history.product)
  priceHistories: ProductPriceHistory[];

  @OneToMany(() => MealItem, (mealItem) => mealItem.product)
  mealItems: MealItem[];
}
