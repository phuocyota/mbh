import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Employee } from './employee.entity';

@Entity('work_schedules')
export class WorkSchedule extends BaseEntity {
  @Column('uuid', { name: 'employee_id' })
  employeeId: string;

  @Column('date', { name: 'work_date' })
  workDate: string;

  @Column('varchar')
  shift: string; // morning, afternoon, full, custom

  @Column('time', { name: 'start_time', nullable: true })
  startTime?: string | null;

  @Column('time', { name: 'end_time', nullable: true })
  endTime?: string | null;

  @Column('text', { nullable: true })
  note: string;

  // Relations
  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
}
