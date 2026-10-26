import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkScheduleService } from './work-schedule.service';
import { UserType } from '../../common/enum/user-type.enum';

const actor = {
  userId: 'user-a',
  userType: UserType.MANAGER,
  branchId: 'branch-a',
};
const row = {
  employeeId: 'employee-a',
  workDate: '2026-10-26',
  shift: 'morning',
  note: 'Trực nhật',
};

describe('WorkScheduleService scope and transactions', () => {
  let service: WorkScheduleService;
  let schedules: any;
  let employees: any;
  let transactionRepo: any;
  let socket: any;

  beforeEach(() => {
    transactionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (values) => values),
      delete: jest.fn().mockResolvedValue({ affected: 2 }),
      count: jest.fn().mockResolvedValue(0),
    };
    schedules = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'schedule-a', ...row }),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'schedule-a', ...value })),
      remove: jest.fn(),
      delete: jest.fn(),
      manager: {
        transaction: jest.fn(async (callback) =>
          callback({ getRepository: () => transactionRepo }),
        ),
      },
    };
    employees = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: row.employeeId, branchId: actor.branchId }),
      find: jest
        .fn()
        .mockResolvedValue([
          { id: row.employeeId, code: 'NV001', fullName: 'Nhân viên A' },
        ]),
    };
    socket = { emitDashboardUpdated: jest.fn() };
    service = new WorkScheduleService(schedules, employees, socket);
  });

  it('uses token branch even when a different query branch is supplied', () => {
    expect(service.resolveBranch(actor, 'branch-b')).toBe('branch-a');
    expect(() =>
      service.resolveBranch({ ...actor, branchId: undefined }, 'branch-b'),
    ).toThrow(ForbiddenException);
    expect(
      service.resolveBranch(
        { ...actor, branchId: undefined, userType: UserType.ADMIN },
        'branch-b',
      ),
    ).toBe('branch-b');
  });

  it('does not return weekly schedules for an employee outside the branch', async () => {
    employees.find.mockResolvedValue([]);
    await expect(
      service.getWeeklyTimeSheet(
        '2026-10-26',
        '2026-11-01',
        'employee-b',
        actor.branchId,
      ),
    ).resolves.toEqual([]);
    expect(employees.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'employee-b', branchId: actor.branchId },
      }),
    );
    expect(schedules.find).not.toHaveBeenCalled();
  });

  it('does not return monthly schedules for an employee outside the branch', async () => {
    employees.findOne.mockResolvedValue(null);
    await expect(
      service.getMonthlySchedule(2026, 10, 'employee-b', actor.branchId),
    ).resolves.toEqual([]);
    expect(schedules.find).not.toHaveBeenCalled();
  });

  it.each(['read', 'create', 'update', 'delete', 'weekly', 'import'])(
    'rejects cross-branch %s before mutation',
    async (operation) => {
      employees.findOne.mockResolvedValue(null);
      const tasks = {
        read: () => service.findOneForUser('schedule-b', actor),
        create: () => service.create(row, actor),
        update: () => service.update('schedule-b', row, actor),
        delete: () => service.hardDelete('schedule-b', actor),
        weekly: () =>
          service.createWeeklySchedule(
            {
              employeeId: row.employeeId,
              fromDate: row.workDate,
              toDate: row.workDate,
              weeklyShifts: [{ dayOfWeek: 1, shift: 'morning' }],
            },
            actor,
          ),
        import: () => service.importSchedules({ schedules: [row] }, actor),
      };
      await expect(tasks[operation]()).rejects.toThrow(NotFoundException);
      expect(schedules.save).not.toHaveBeenCalled();
      expect(schedules.remove).not.toHaveBeenCalled();
      expect(schedules.manager.transaction).not.toHaveBeenCalled();
    },
  );

  it('checks both the original and replacement employee when updating', async () => {
    employees.findOne
      .mockResolvedValueOnce({ id: row.employeeId })
      .mockResolvedValueOnce(null);
    await expect(
      service.update('schedule-a', { ...row, employeeId: 'employee-b' }, actor),
    ).rejects.toThrow(NotFoundException);
    expect(schedules.save).not.toHaveBeenCalled();
  });

  it('preserves note, ID and full date in the weekly response across a month boundary', async () => {
    schedules.find.mockResolvedValue([
      { id: 'schedule-a', ...row },
      { id: 'schedule-b', ...row, workDate: '2026-11-01', shift: 'full' },
    ]);
    const result = await service.getWeeklyTimeSheet(
      '2026-10-26',
      '2026-11-01',
      undefined,
      actor.branchId,
    );
    expect(result[0].shiftDetails[26]).toEqual(
      expect.objectContaining({
        id: 'schedule-a',
        note: row.note,
        workDate: row.workDate,
      }),
    );
    expect(result[0].shifts[1]).toBe('full');
  });

  it('writes the authenticated actor and allows clearing a note', async () => {
    await service.update('schedule-a', { ...row, note: '' }, actor);
    expect(schedules.save).toHaveBeenCalledWith(
      expect.objectContaining({ updatedBy: actor.userId, note: '' }),
    );
  });

  const weekly = {
    employeeId: row.employeeId,
    fromDate: '2026-10-26',
    toDate: '2026-11-22',
    replaceExisting: true,
    weeklyShifts: [{ dayOfWeeks: [1, 3, 5], shift: 'morning' }],
  };

  it('replaces and saves all 12 weekly slots through the same transaction repository', async () => {
    const result = await service.createWeeklySchedule(weekly, actor);
    expect(result).toEqual(
      expect.objectContaining({ created: 12, replaced: 2 }),
    );
    expect(transactionRepo.delete).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save.mock.calls[0][0]).toHaveLength(12);
    expect(schedules.delete).not.toHaveBeenCalled();
    expect(schedules.save).not.toHaveBeenCalled();
    expect(transactionRepo.save.mock.calls[0][0][0].createdBy).toBe(
      actor.userId,
    );
  });

  it('propagates a save error out of the weekly transaction without a success event', async () => {
    transactionRepo.save.mockRejectedValue(new Error('DB failure'));
    await expect(service.createWeeklySchedule(weekly, actor)).rejects.toThrow(
      'DB failure',
    );
    expect(schedules.manager.transaction).toHaveBeenCalledTimes(1);
    expect(socket.emitDashboardUpdated).not.toHaveBeenCalled();
  });

  it('rejects import conflicts when replacement is not selected', async () => {
    transactionRepo.count.mockResolvedValue(1);
    await expect(
      service.importSchedules({ schedules: [row] }, actor),
    ).rejects.toThrow(ConflictException);
    expect(transactionRepo.delete).not.toHaveBeenCalled();
    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it('imports the entire batch in one transaction with actual replaced count', async () => {
    transactionRepo.count.mockResolvedValue(1);
    const result = await service.importSchedules(
      {
        schedules: [row, { ...row, workDate: '2026-10-27' }],
        replaceExisting: true,
      },
      actor,
    );
    expect(result).toEqual({ created: 2, replaced: 4 });
    expect(schedules.manager.transaction).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate import dates before entering a transaction', async () => {
    await expect(
      service.importSchedules({ schedules: [row, row] }, actor),
    ).rejects.toThrow(BadRequestException);
    expect(schedules.manager.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-10-27', '2026-10-26'],
    ['2026-10-26', '2026-11-02'],
    [undefined, '2026-10-26'],
  ])('rejects invalid weekly date range %s to %s', async (from, to) => {
    await expect(
      service.getWeeklyTimeSheet(from as string, to),
    ).rejects.toThrow(BadRequestException);
    expect(schedules.find).not.toHaveBeenCalled();
  });
});
