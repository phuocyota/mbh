import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Product } from './product.entity';
import { COMMON_STATUS } from '../common/constant/constant';
import { Branch } from './branch.entity';

@Entity('categories')
export class Category extends BaseEntity {
  @Column('uuid', { name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column('varchar')
  name: string;

  @Column('int', { default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column('varchar', { default: COMMON_STATUS.ACTIVE })
  status: string;

  // Relations
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @ManyToOne(() => Branch, (branch) => branch.categories, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;
}
