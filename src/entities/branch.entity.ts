import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { POSDevice } from './pos-device.entity';
import { COMMON_STATUS } from '../common/constant/constant';
import { Category } from './category.entity';
import { Product } from './product.entity';
import { Payroll } from './payroll.entity';

@Entity('branches')
export class Branch extends BaseEntity {
  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  address: string;

  @Column('varchar', { default: COMMON_STATUS.ACTIVE })
  status: string;

  // Branch-level setting: default/max debt allowance applied to customers in this branch.
  @Column('numeric', {
    precision: 15,
    scale: 2,
    default: 50000,
    name: 'max_customer_debt',
  })
  maxCustomerDebt: number;

  // Relations
  @OneToMany(() => POSDevice, (device) => device.branch)
  posDevices: POSDevice[];

  @OneToMany(() => Category, (category) => category.branch)
  categories: Category[];

  @OneToMany(() => Product, (product) => product.branch)
  products: Product[];

  @OneToMany(() => Payroll, (payroll) => payroll.branch)
  payrolls: Payroll[];

  @OneToMany('Order', 'branch')
  orders: any[];

  @OneToMany('Shift', 'branch')
  shifts: any[];
}
