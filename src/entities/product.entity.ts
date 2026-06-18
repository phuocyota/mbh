import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Category } from './category.entity';
import { StockItem } from '../../packages/inventory/src/index.js';

@Entity('products')
export class Product extends BaseEntity implements StockItem {
  @Column('uuid', { name: 'category_id' })
  categoryId: string;

  @Column('varchar', { unique: true })
  sku: string;

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true, name: 'image_url' })
  imageUrl: string;

  @Column('numeric', { precision: 12, scale: 2 })
  price: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'cost_price',
  })
  costPrice: number;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  quantity: number;

  @Column('varchar')
  unit: string; // phần, ly, cái, hộp

  @Column('boolean', { default: true, name: 'is_active' })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category;
}
