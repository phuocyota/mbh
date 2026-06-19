import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Product } from './product.entity';
import { Stock } from './stock.entity';

@Entity('stock_items')
@Unique(['stockId', 'productId'])
export class StockItem extends BaseEntity {
  @Column('uuid', { name: 'stock_id' })
  stockId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  quantity: number;

  @ManyToOne(() => Stock, (stock) => stock.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
