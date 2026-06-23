import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Category } from './category.entity';

@Entity('products')
export class Product extends BaseEntity {
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

  @Column('varchar')
  unit: string; // phần, ly, cái, hộp

  @Column('boolean', { default: true, name: 'is_active' })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category;
}
