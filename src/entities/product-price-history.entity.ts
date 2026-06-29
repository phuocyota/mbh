import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Product } from './product.entity';

@Entity('product_price_history')
export class ProductPriceHistory extends BaseEntity {
  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'old_price',
  })
  oldPrice: number | null;

  @Column('numeric', { precision: 12, scale: 2, name: 'new_price' })
  newPrice: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'old_cost_price',
  })
  oldCostPrice: number | null;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'new_cost_price',
  })
  newCostPrice: number | null;

  @Column('varchar', { default: 'UPDATE', name: 'change_type' })
  changeType: string;

  @Column('text', { nullable: true })
  note: string | null;

  @ManyToOne(() => Product, (product) => product.priceHistories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
