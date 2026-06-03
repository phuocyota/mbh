import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';

@Entity('payrolls')
export class Payroll extends BaseEntity {
  @Column('varchar', { unique: true, name: 'code' })
  code: string;

  @Column('varchar', { name: 'name' })
  name: string;

  @Column('varchar', { name: 'cycle', default: 'monthly' })
  cycle: string; // monthly, custom

  @Column('varchar', { name: 'period_start' })
  periodStart: string;

  @Column('varchar', { name: 'period_end' })
  periodEnd: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0, name: 'total_salary' })
  totalSalary: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  paid: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  remaining: number;

  @Column('varchar', { default: 'draft' })
  status: string; // draft, estimated, finalized, cancelled

  @Column('text', { nullable: true })
  note: string;
}
