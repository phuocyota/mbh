import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Product } from './product.entity';
import { StockTransfer } from './stock-transfer.entity';

@Entity('stock_transfer_items')
export class StockTransferItem extends BaseEntity {
  @Column('uuid', { name: 'transfer_id' })
  transferId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('numeric', { precision: 12, scale: 2 })
  quantity: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'unit_cost' })
  unitCost: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => StockTransfer, (transfer) => transfer.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transfer_id' })
  transfer: StockTransfer;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
