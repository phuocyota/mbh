import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('carts')
export class Cart extends BaseEntity {
  @Column('uuid', { nullable: true, name: 'customer_id' })
  customerId: string;

  @Column('varchar', { nullable: true })
  sessionId: string;

  @Column('uuid', {
    nullable: true,
    name: 'branch_id',
    default: DEFAULT_BRANCH_ID,
  })
  branchId: string;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column('int', { default: 0 })
  itemCount: number;

  // Relations
  @OneToMany('CartItem', 'cart', { cascade: true })
  items: any[];
}
