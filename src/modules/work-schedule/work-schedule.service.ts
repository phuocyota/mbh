import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { UserType } from '../../common/enum/user-type.enum';
import { ImportWorkSchedulesDto } from './dto/import-work-schedules.dto';
import { SocketService } from '../socket/socket.service';

@Injectable()
export class WorkScheduleService extends BaseService<WorkSchedule> {
  constructor(
    @InjectRepository(WorkSchedule)
    private workScheduleRepository: Repository<WorkSchedule>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private socketService: SocketService,
  ) {
    super(workScheduleRepository);
  }

  protected getEntityName(): string {
    return 'WorkSchedule';
  }

  resolveBranch(
    user: JwtPayload,
    requestedBranch?: string,
  ): string | undefined {
    if (user.branchId) return user.branchId;
    if (user.userType === UserType.ADMIN) return requestedBranch;
    throw new ForbiddenException('Tài khoản chưa được gán chi nhánh');
  }

  private async assertEmployeeScope(employeeId: string, user: JwtPayload) {
    const branchId = this.resolveBranch(user);
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId, ...(branchId ? { branchId } : {}) },
    });
    if (!employee)
      throw new NotFoundException('Không tìm thấy nhân viên trong chi nhánh');
    return employee;
  }

  async findOneForUser(id: string, user: JwtPayload) {
    const schedule = await super.findOne(id);
    await this.assertEmployeeScope(schedule.employeeId, user);
    return schedule;
  }

  async create(
    dto: CreateWorkScheduleDto,
    user: JwtPayload,
  ): Promise<WorkSchedule> {
    await this.assertEmployeeScope(dto.employeeId, user);
    const schedule = await super.create(this.buildSchedulePayload(dto), user);
    this.emitDashboardUpdate('created', schedule);
    return schedule;
  }

  async update(
    id: string,
    dto: CreateWorkScheduleDto,
    user: JwtPayload,
  ): Promise<WorkSchedule> {
    await this.findOneForUser(id, user);
    await this.assertEmployeeScope(dto.employeeId, user);
    const schedule = await super.update(
      id,
      this.buildSchedulePayload(dto),
      user,
    );
    this.emitDashboardUpdate('updated', schedule);
    return schedule;
  }

  async createWeeklySchedule(
    dto: CreateWeeklyWorkScheduleDto,
    user: JwtPayload,
  ) {
    await this.assertEmployeeScope(dto.employeeId, user);
    const fromDate = this.parseDateKey(dto.fromDate);
    const toDate = this.parseDateKey(dto.toDate);

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException(
        'fromDate must be before or equal to toDate',
      );
    }

    const slotByDay = new Map<number, WeeklyWorkScheduleSlotDto>();
    for (const slot of dto.weeklyShifts) {
      this.buildSchedulePayload({
        employeeId: dto.employeeId,
        workDate: dto.fromDate,
        shift: slot.shift,
        startTime: slot.startTime,
        endTime: slot.endTime,
        note: slot.note,
      });

      for (const dayOfWeek of this.getSlotDays(slot)) {
        if (slotByDay.has(dayOfWeek)) {
          throw new BadRequestException(
            `Duplicate weekly shift for dayOfWeek ${dayOfWeek}`,
          );
        }

        slotByDay.set(dayOfWeek, slot);
      }
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

    const { createdSchedules, replaced } =
      await this.workScheduleRepository.manager.transaction(async (manager) => {
        const repo = manager.getRepository(WorkSchedule);
        let replaced = 0;
        if (replaceExisting) {
          const result = await repo.delete({
            employeeId: dto.employeeId,
            workDate: In(workDates),
          });
          replaced = result.affected ?? 0;
        }
        const createdSchedules = await repo.save(
          schedules.map((schedule) =>
            repo.create({
              ...schedule,
              createdBy: user.userId,
            }),
          ),
        );
        return { createdSchedules, replaced };
      });
    this.socketService.emitDashboardUpdated({
      source: 'work-schedule',
      action: 'weekly-updated',
      entityId: dto.employeeId,
    });

    return {
      created: createdSchedules.length,
      replaced,
      schedules: createdSchedules,
    };
  }

  async hardDelete(id: string, user?: JwtPayload): Promise<WorkSchedule> {
    if (!user) throw new ForbiddenException('Thiếu thông tin người dùng');
    await this.findOneForUser(id, user);
    const schedule = await super.hardDelete(id);
    this.emitDashboardUpdate('deleted', schedule);
    return schedule;
  }

  async importSchedules(dto: ImportWorkSchedulesDto, user: JwtPayload) {
    // Validate every row and its scope before starting any mutation.
    const keys = new Set<string>();
    for (const row of dto.schedules) {
      this.parseDateKey(row.workDate);
      this.buildSchedulePayload(row);
      const key = `${row.employeeId}:${row.workDate}`;
      if (keys.has(key))
        throw new BadRequestException('Trùng nhân viên/ngày trong file import');
      keys.add(key);
    }
    for (const employeeId of new Set(
      dto.schedules.map((row) => row.employeeId),
    )) {
      await this.assertEmployeeScope(employeeId, user);
    }
    const result = await this.workScheduleRepository.manager.transaction(
      async (manager) => {
        const repo = manager.getRepository(WorkSchedule);
        let replaced = 0;
        for (const row of dto.schedules) {
          const where = { employeeId: row.employeeId, workDate: row.workDate };
          const count = await repo.count({ where });
          if (count && !dto.replaceExisting) {
            throw new ConflictException(
              `Đã có lịch ngày ${row.workDate}; chọn thay thế lịch cũ để tiếp tục`,
            );
          }
          if (count) {
            const deleted = await repo.delete(where);
            replaced += deleted.affected ?? 0;
          }
        }
        await repo.save(
          dto.schedules.map((row) =>
            repo.create({
              ...this.buildSchedulePayload(row),
              createdBy: user.userId,
            }),
          ),
        );
        return { created: dto.schedules.length, replaced };
      },
    );
    this.socketService.emitDashboardUpdated({
      source: 'work-schedule',
      action: 'imported',
    });
    return result;
  }

  private emitDashboardUpdate(action: string, schedule: WorkSchedule) {
    this.socketService.emitDashboardUpdated({
      source: 'work-schedule',
      action,
      entityId: schedule.id,
    });
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
    const fromDate = this.parseDateKey(from);
    const toDate = this.parseDateKey(to);
    if (
      fromDate > toDate ||
      (toDate.getTime() - fromDate.getTime()) / 86400000 > 6
    ) {
      throw new BadRequestException(
        'Khoảng thời gian phải nằm trong tối đa 7 ngày',
      );
    }
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
    if (!employeeIds.length) return [];
    where.employeeId = In(employeeIds);

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
      const day = Number(record.workDate.slice(8, 10));
      employeeMap.get(empId).shifts[day] = record.shift;
      employeeMap.get(empId).shiftDetails ??= {};
      employeeMap.get(empId).shiftDetails[day] = {
        id: record.id,
        workDate: record.workDate,
        note: record.note,
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
    if (
      !Number.isInteger(year) ||
      year < 1 ||
      year > 9999 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new BadRequestException('Năm hoặc tháng không hợp lệ');
    }
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const where: any = {
      workDate: Between(from, to),
    };
    if (employeeId && branchId) {
      const employee = await this.employeeRepository.findOne({
        where: { id: employeeId, branchId },
      });
      if (!employee) return [];
    }
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

  private buildSchedulePayload(
    dto: CreateWorkScheduleDto,
  ): Partial<WorkSchedule> {
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

  private getSlotDays(slot: WeeklyWorkScheduleSlotDto): number[] {
    if (slot.dayOfWeeks?.length) {
      return slot.dayOfWeeks;
    }

    if (slot.dayOfWeek === undefined || slot.dayOfWeek === null) {
      throw new BadRequestException('dayOfWeek or dayOfWeeks is required');
    }

    return [slot.dayOfWeek];
  }

  private parseDateKey(dateKey: string) {
    if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD');
    }
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || this.toDateKey(date) !== dateKey) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    return date;
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
