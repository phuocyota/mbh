import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Product } from './product.entity';
import { StockTake } from './stock-take.entity';

@Entity('stock_take_items')
export class StockTakeItem extends BaseEntity {
  @Column('uuid', { name: 'stock_take_id' })
  stockTakeId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('numeric', { precision: 12, scale: 2, name: 'system_quantity' })
  systemQuantity: number;

  @Column('numeric', { precision: 12, scale: 2, name: 'actual_quantity' })
  actualQuantity: number;

  @Column('numeric', { precision: 12, scale: 2, default: 0, name: 'difference_quantity' })
  differenceQuantity: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'unit_cost' })
  unitCost: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'difference_amount' })
  differenceAmount: number;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => StockTake, (stockTake) => stockTake.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'stock_take_id' })
  stockTake: StockTake;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
