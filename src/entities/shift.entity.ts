import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { POSDevice } from './pos-device.entity';
import { User } from './user.entity';
import { DEFAULT_BRANCH_ID } from '../common/constant/default-branch.constant';

@Entity('shifts')
export class Shift extends BaseEntity {
  @Column('uuid', { name: 'branch_id', default: DEFAULT_BRANCH_ID })
  branchId: string;

  @Column('uuid', { name: 'pos_device_id' })
  posDeviceId: string;

  @Column('uuid', { name: 'cashier_id' })
  cashierId: string;

  @Column('numeric', { precision: 12, scale: 2, name: 'opening_cash' })
  openingCash: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'closing_cash',
  })
  closingCash: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'expected_cash',
  })
  expectedCash: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'difference_cash',
  })
  differenceCash: number;

  @Column('varchar', { default: 'OPEN' })
  status: string; // OPEN, CLOSED

  @Column('timestamp', { name: 'opened_at' })
  openedAt: Date;

  @Column('timestamp', { nullable: true, name: 'closed_at' })
  closedAt: Date;

  @Column('text', { nullable: true })
  note: string;

  // Relations
  @ManyToOne(() => Branch, (branch) => branch.shifts)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => POSDevice, (device) => device.shifts)
  @JoinColumn({ name: 'pos_device_id' })
  posDevice: POSDevice;

  @ManyToOne(() => User, (user) => user.shifts)
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @OneToMany('CashMovement', 'shift', { cascade: true })
  cashMovements: any[];
}
