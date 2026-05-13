import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Shift } from './shift.entity';
import { User } from './user.entity';

@Entity('cash_movements')
export class CashMovement extends BaseEntity {
  @Column('uuid', { name: 'shift_id' })
  shiftId: string;

  @Column('varchar')
  type: string; // CASH_IN, CASH_OUT

  @Column('numeric', { precision: 12, scale: 2 })
  amount: number;

  @Column('text', { nullable: true })
  reason: string;

  // Relations
  @ManyToOne(() => Shift, (shift) => shift.cashMovements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;
}
