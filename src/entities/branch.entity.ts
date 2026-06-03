import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { POSDevice } from './pos-device.entity';
import { COMMON_STATUS } from '../common/constant/constant';

@Entity('branches')
export class Branch extends BaseEntity {
  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  address: string;

  @Column('varchar', { default: COMMON_STATUS.ACTIVE })
  status: string;

  // Relations
  @OneToMany(() => POSDevice, (device) => device.branch)
  posDevices: POSDevice[];

  @OneToMany('Order', 'branch')
  orders: any[];

  @OneToMany('StockLevel', 'branch')
  stockLevels: any[];

  @OneToMany('StockTransaction', 'branch')
  stockTransactions: any[];

  @OneToMany('Shift', 'branch')
  shifts: any[];

  @OneToMany('KitchenTicket', 'branch')
  kitchenTickets: any[];
}
