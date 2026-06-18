import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { WarehouseVoucher } from './warehouse-voucher.entity';
import { Product } from './product.entity';

@Entity('warehouse_voucher_items')
export class WarehouseVoucherItem extends BaseEntity {
  @Column('uuid', { name: 'voucher_id' })
  voucherId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('numeric', { precision: 12, scale: 2 })
  quantity: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'unit_price' })
  unitPrice: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column('text', { nullable: true })
  note: string;

  @ManyToOne(() => WarehouseVoucher, (voucher) => voucher.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'voucher_id' })
  voucher: WarehouseVoucher;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
