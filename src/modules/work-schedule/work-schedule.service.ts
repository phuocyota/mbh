import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { WorkSchedule } from '../../entities/work-schedule.entity';
import { BaseService } from '../../common/sql/base.service';

@Injectable()
export class WorkScheduleService extends BaseService<WorkSchedule> {
  constructor(
    @InjectRepository(WorkSchedule)
    private workScheduleRepository: Repository<WorkSchedule>,
  ) {
    super(workScheduleRepository);
  }

  protected getEntityName(): string {
    return 'WorkSchedule';
  }

  /**
   * Lấy lịch làm việc theo tuần (từ ngày - đến ngày)
   * Trả về format phù hợp với FE timeSheetData:
   * [{ employeeId, employeeName, employeeCode, salary, shifts: { day: shiftType } }]
   */
  async getWeeklyTimeSheet(from: string, to: string, employeeId?: string) {
    const where: any = {
      workDate: Between(from, to),
    };
    if (employeeId) where.employeeId = employeeId;

    const records = await this.workScheduleRepository.find({
      where,
      relations: ['employee'],
      order: { workDate: 'ASC' },
    });

    const employeeMap = new Map<string, any>();

    for (const record of records) {
      const empId = record.employeeId;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          id: empId,
          code: record.employee?.code,
          name: record.employee?.fullName,
          debt: record.employee?.debt ?? 0,
          shifts: {},
        });
      }
      const day = new Date(record.workDate).getDate();
      employeeMap.get(empId).shifts[day] = record.shift;
    }

    return Array.from(employeeMap.values());
  }

  /**
   * Lấy lịch làm việc theo tháng (dạng workScheduleData của FE)
   * month: 1-12, year: YYYY
   */
  async getMonthlySchedule(year: number, month: number, employeeId?: string) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const where: any = {
      workDate: Between(from, to),
    };
    if (employeeId) where.employeeId = employeeId;

    const records = await this.workScheduleRepository.find({
      where,
      relations: ['employee'],
      order: { workDate: 'ASC' },
    });

    return records.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee?.fullName,
      employeeCode: r.employee?.code,
      workDate: r.workDate,
      shift: r.shift,
      note: r.note,
    }));
  }
}
