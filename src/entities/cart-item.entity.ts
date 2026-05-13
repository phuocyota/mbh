import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Cart } from './cart.entity';

@Entity('cart_items')
export class CartItem extends BaseEntity {
  @Column('uuid', { name: 'cart_id' })
  cartId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('varchar', { name: 'product_name' })
  productName: string;

  @Column('numeric', { precision: 12, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column('int')
  quantity: number;

  @Column('numeric', { precision: 12, scale: 2 })
  subtotal: number;

  @Column('text', { nullable: true })
  note: string;

  // Relations
  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @ManyToOne('Product')
  @JoinColumn({ name: 'product_id' })
  product: any;
}
