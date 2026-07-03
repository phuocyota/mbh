import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { WorkSchedule } from '../../entities/work-schedule.entity';
import { Employee } from '../../entities/employee.entity';
import { BaseService } from '../../common/sql/base.service';
import { JwtPayload } from '../../common/interface/jwt-payload.interface';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import {
  CreateWeeklyWorkScheduleDto,
  WeeklyWorkScheduleSlotDto,
} from './dto/create-weekly-work-schedule.dto';

@Injectable()
export class WorkScheduleService extends BaseService<WorkSchedule> {
  constructor(
    @InjectRepository(WorkSchedule)
    private workScheduleRepository: Repository<WorkSchedule>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {
    super(workScheduleRepository);
  }

  protected getEntityName(): string {
    return 'WorkSchedule';
  }

  async create(dto: CreateWorkScheduleDto, user: JwtPayload): Promise<WorkSchedule> {
    return super.create(this.buildSchedulePayload(dto), user);
  }

  async update(
    id: string,
    dto: CreateWorkScheduleDto,
    user: JwtPayload,
  ): Promise<WorkSchedule> {
    return super.update(id, this.buildSchedulePayload(dto), user);
  }

  async createWeeklySchedule(
    dto: CreateWeeklyWorkScheduleDto,
    user: JwtPayload,
  ) {
    const fromDate = this.parseDateKey(dto.fromDate);
    const toDate = this.parseDateKey(dto.toDate);

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate must be before or equal to toDate');
    }

    const slotByDay = new Map<number, WeeklyWorkScheduleSlotDto>();
    for (const slot of dto.weeklyShifts) {
      if (slotByDay.has(slot.dayOfWeek)) {
        throw new BadRequestException(
          `Duplicate weekly shift for dayOfWeek ${slot.dayOfWeek}`,
        );
      }

      this.buildSchedulePayload({
        employeeId: dto.employeeId,
        workDate: dto.fromDate,
        shift: slot.shift,
        startTime: slot.startTime,
        endTime: slot.endTime,
        note: slot.note,
      });
      slotByDay.set(slot.dayOfWeek, slot);
    }

    const schedules = this.buildWeekScheduleDates(
      dto.employeeId,
      fromDate,
      toDate,
      slotByDay,
    );
    if (!schedules.length) {
      return {
        created: 0,
        replaced: 0,
        schedules: [],
      };
    }

    const workDates = schedules.map((schedule) => schedule.workDate as string);
    const replaceExisting = dto.replaceExisting ?? true;

    if (replaceExisting) {
      await this.workScheduleRepository.delete({
        employeeId: dto.employeeId,
        workDate: In(workDates),
      });
    }

    const createdSchedules = await this.workScheduleRepository.save(
      schedules.map((schedule) =>
        this.workScheduleRepository.create({
          ...schedule,
          createdBy: user.userId,
        }),
      ),
    );

    return {
      created: createdSchedules.length,
      replaced: replaceExisting ? workDates.length : 0,
      schedules: createdSchedules,
    };
  }

  /**
   * Lấy lịch làm việc theo tuần (từ ngày - đến ngày)
   * Trả về format phù hợp với FE timeSheetData:
   * [{ employeeId, employeeName, employeeCode, salary, shifts: { day: shiftType } }]
   */
  async getWeeklyTimeSheet(
    from: string,
    to: string,
    employeeId?: string,
    branchId?: string,
  ) {
    const employeeWhere: any = {};
    if (employeeId) employeeWhere.id = employeeId;
    if (branchId) employeeWhere.branchId = branchId;

    const employees = await this.employeeRepository.find({
      where: employeeWhere,
      order: { code: 'ASC' },
    });
    const employeeIds = employees.map((employee) => employee.id);

    const where: any = {
      workDate: Between(from, to),
    };
    if (employeeId) {
      where.employeeId = employeeId;
    } else if (branchId) {
      if (!employeeIds.length) return [];
      where.employeeId = In(employeeIds);
    }

    const records = await this.workScheduleRepository.find({
      where,
      relations: ['employee'],
      order: { workDate: 'ASC' },
    });

    const employeeMap = new Map<string, any>();

    for (const employee of employees) {
      employeeMap.set(employee.id, {
        id: employee.id,
        code: employee.code,
        name: employee.fullName,
        debt: employee.debt ?? 0,
        shifts: {},
      });
    }

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
      employeeMap.get(empId).shiftDetails ??= {};
      employeeMap.get(empId).shiftDetails[day] = {
        shift: record.shift,
        startTime: record.startTime,
        endTime: record.endTime,
      };
    }

    return Array.from(employeeMap.values());
  }

  /**
   * Lấy lịch làm việc theo tháng (dạng workScheduleData của FE)
   * month: 1-12, year: YYYY
   */
  async getMonthlySchedule(
    year: number,
    month: number,
    employeeId?: string,
    branchId?: string,
  ) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const where: any = {
      workDate: Between(from, to),
    };
    if (employeeId) {
      where.employeeId = employeeId;
    } else if (branchId) {
      const employees = await this.employeeRepository.find({
        where: { branchId },
        select: ['id'],
      });
      const employeeIds = employees.map((employee) => employee.id);
      if (!employeeIds.length) return [];
      where.employeeId = In(employeeIds);
    }

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
      startTime: r.startTime,
      endTime: r.endTime,
      note: r.note,
    }));
  }

  private buildSchedulePayload(dto: CreateWorkScheduleDto): Partial<WorkSchedule> {
    if (dto.shift !== 'custom') {
      return {
        ...dto,
        startTime: null,
        endTime: null,
      };
    }

    if (!dto.startTime || !dto.endTime) {
      throw new BadRequestException(
        'startTime and endTime are required when shift is custom',
      );
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    return dto;
  }

  private buildWeekScheduleDates(
    employeeId: string,
    fromDate: Date,
    toDate: Date,
    slotByDay: Map<number, WeeklyWorkScheduleSlotDto>,
  ): Partial<WorkSchedule>[] {
    const schedules: Partial<WorkSchedule>[] = [];
    let current = new Date(fromDate);

    while (current.getTime() <= toDate.getTime()) {
      const dayOfWeek = current.getUTCDay();
      const slot = slotByDay.get(dayOfWeek);

      if (slot) {
        schedules.push(
          this.buildSchedulePayload({
            employeeId,
            workDate: this.toDateKey(current),
            shift: slot.shift,
            startTime: slot.startTime,
            endTime: slot.endTime,
            note: slot.note,
          }),
        );
      }

      current = this.addDays(current, 1);
    }

    return schedules;
  }

  private parseDateKey(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
  }

  private toDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
