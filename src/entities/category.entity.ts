import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Product } from './product.entity';
import { COMMON_STATUS } from '../common/constant/constant';

@Entity('categories')
export class Category extends BaseEntity {
  @Column('varchar')
  name: string;

  @Column('int', { default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column('varchar', { default: COMMON_STATUS.ACTIVE })
  status: string;

  // Relations
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
