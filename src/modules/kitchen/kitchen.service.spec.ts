import { ConflictException, ForbiddenException } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { DataSource } from 'typeorm';

function createService() {
  const service = Object.create(KitchenService.prototype);
  service.config = {
    get: jest.fn().mockReturnValue(undefined),
  };
  service.tickets = { find: jest.fn().mockResolvedValue([]) };
  return service as KitchenService & Record<string, any>;
}

describe('KitchenService authorization and concurrency', () => {
  it('keeps made-to-order finished goods out of direct-sale stock export', async () => {
    const service = createService();
    service.products = { find: jest.fn().mockResolvedValue([{ id: 'bread' }]) };
    const order = {
      branchId: 'branch1',
      items: [
        { productId: 'bread', quantity: 1 },
        { productId: 'milk', quantity: 1 },
      ],
    };
    expect(await service.orderForLegacyStockExport(order)).toEqual({
      ...order,
      items: [{ productId: 'milk', quantity: 1 }],
    });
    expect(order.items).toHaveLength(2);
  });
  it('shows a paid canteen ticket on overview without inventing a production batch', async () => {
    const service = createService();
    service.mealPlans = { find: jest.fn().mockResolvedValue([]) };
    service.getDemand = jest.fn().mockResolvedValue([]);
    service.tickets = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            id: 't1',
            status: 'WAITING',
            order: { orderCode: 'TEST', orderNumber: 123 },
            items: [
              { productId: 'bread', productName: 'Bánh mì', quantity: 1 },
            ],
          },
        ]),
    };
    service.products = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'bread', name: 'Bánh mì', productType: 'FINISHED_GOOD' },
        ]),
    };
    const result = await service.staffOverview(
      { userId: 'u', userType: 'KITCHEN', branchId: 'branch1' },
      { date: '2026-10-20' },
    );
    expect(result).toMatchObject({
      taskCount: 1,
      completedCount: 0,
      dishCount: 1,
      batches: [],
      tickets: [{ id: 't1', items: [{ name: 'Bánh mì', quantity: 1 }] }],
    });
    expect(service.tickets.find.mock.calls[0][0].where.branchId).toBe(
      'branch1',
    );
  });
  it('aggregates staff work from real batches and checks demand once for the whole day', async () => {
    const service = createService();
    service.mealPlans = {
      find: jest.fn().mockResolvedValue([
        {
          mealPeriod: 'LUNCH',
          batches: [
            {
              id: 'b1',
              productId: 'dish1',
              plannedQuantity: 100,
              adjustmentQuantity: 5,
              status: 'COMPLETED',
              startedAt: '2026-10-20T01:00:00Z',
            },
            {
              id: 'b2',
              productId: 'dish2',
              plannedQuantity: 50,
              adjustmentQuantity: 0,
              status: 'PREPARING',
              startedAt: '2026-10-20T02:00:00Z',
            },
          ],
        },
        {
          mealPeriod: 'DINNER',
          batches: [
            {
              id: 'b3',
              productId: 'dish1',
              plannedQuantity: 20,
              adjustmentQuantity: 0,
              status: 'WAITING',
            },
          ],
        },
      ]),
    };
    service.getDemand = jest
      .fn()
      .mockResolvedValue([
        { productId: 'rice', quantity: 10, availableQuantity: 6, unitId: 'kg' },
      ]);
    service.products = {
      find: jest.fn().mockResolvedValue([
        { id: 'dish1', name: 'Cơm', unit: 'phần', requiresSample: true },
        { id: 'dish2', name: 'Canh', unit: 'phần', requiresSample: true },
        { id: 'rice', name: 'Gạo' },
      ]),
    };
    service.units = {
      find: jest.fn().mockResolvedValue([{ id: 'kg', code: 'kg' }]),
    };
    service.dataSource = {
      getRepository: () => ({
        find: jest.fn().mockResolvedValue([
          {
            parentId: 'b1',
            payload: { quantity: 1, sampledAt: '2026-10-20T01:30:00Z' },
          },
          {
            parentId: 'b2',
            payload: { quantity: 1, sampledAt: '2026-10-19T02:30:00Z' },
          },
        ]),
      }),
    };
    const result = await service.staffOverview(
      { userId: 'u', userType: 'KITCHEN', branchId: 'branch1' },
      { date: '2026-10-20' },
    );
    expect(result).toMatchObject({
      portionQuantity: 175,
      planCount: 2,
      dishCount: 2,
      completedCount: 1,
      taskCount: 3,
      inProgressCount: 1,
      missingSampleCount: 1,
    });
    expect(result.shortages).toEqual([
      expect.objectContaining({ name: 'Gạo', shortageQuantity: 4, unit: 'kg' }),
    ]);
    expect(service.getDemand).toHaveBeenCalledTimes(1);
    expect(service.getDemand).toHaveBeenCalledWith(expect.anything(), {
      branchId: 'branch1',
      date: '2026-10-20',
    });
  });

  it('returns a truthful empty staff overview without fetching unrelated products or samples', async () => {
    const service = createService();
    service.mealPlans = { find: jest.fn().mockResolvedValue([]) };
    service.getDemand = jest.fn().mockResolvedValue([]);
    service.products = { find: jest.fn() };
    service.units = { find: jest.fn() };
    const result = await service.staffOverview(
      { userId: 'u', userType: 'KITCHEN', branchId: 'branch1' },
      { date: '2026-10-20' },
    );
    expect(result).toMatchObject({
      portionQuantity: 0,
      taskCount: 0,
      shortages: [],
      batches: [],
      missingSampleCount: 0,
    });
    expect(service.products.find).not.toHaveBeenCalled();
    expect(service.units.find).not.toHaveBeenCalled();
  });

  it('prevents staff overview access across branches', async () => {
    await expect(
      createService().staffOverview(
        { userId: 'u', userType: 'KITCHEN', branchId: 'branch1' },
        { branchId: 'branch2' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
  it.each([undefined, 'station-1'])(
    'binds the demand date without corrupting the PostgreSQL cast (station %s)',
    async (stationId) => {
      const service = createService();
      const clauses: string[] = [];
      const parameters: Record<string, unknown> = {};
      const builder: any = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn((sql, values) => {
          clauses.push(sql);
          Object.assign(parameters, values);
          return builder;
        }),
        andWhere: jest.fn((sql, values) => {
          clauses.push(sql);
          Object.assign(parameters, values);
          return builder;
        }),
        getMany: jest.fn().mockResolvedValue([]),
      };
      service.mealPlans = { find: jest.fn().mockResolvedValue([]) };
      service.tickets = { createQueryBuilder: () => builder };
      await (service as any).calculateDemand(
        'branch-1',
        '2026-10-20',
        'LUNCH',
        stationId,
      );
      const driver = new DataSource({ type: 'postgres' }).driver;
      const [sql, bindings] = driver.escapeQueryWithParameters(
        clauses.join(' AND '),
        parameters,
        {},
      );
      expect(sql).toContain(
        "CAST(t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS date)=$2",
      );
      expect(sql).not.toMatch(/:\$\d|:date|:branchId/);
      expect(bindings).toEqual([
        'branch-1',
        '2026-10-20',
        'WAITING',
        'PREPARING',
        'READY',
        'DELIVERED',
        ...(stationId ? [stationId] : []),
      ]);
    },
  );

  it('lists active units without requiring a module feature flag', async () => {
    const service = createService();
    const units = [{ id: 'unit-1', code: 'kg', isActive: true }];
    service.units = { find: jest.fn().mockResolvedValue(units) };
    await expect(service.listUnits()).resolves.toEqual(units);
    expect(service.units.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { dimension: 'ASC', factorToBase: 'ASC' },
    });
    expect(service.config.get).not.toHaveBeenCalled();
  });

  it.each(['KITCHEN', 'CASHIER'])('uses the JWT branch for %s', (userType) => {
    const service = createService();
    expect(
      service.resolveBranch({
        userId: 'u1',
        userType,
        branchId: 'b1',
      }),
    ).toBe('b1');
  });

  it.each(['KITCHEN', 'CASHIER'])(
    'rejects a cross-branch %s request',
    (userType) => {
      const service = createService();
      expect(() =>
        service.resolveBranch({ userId: 'u1', userType, branchId: 'b1' }, 'b2'),
      ).toThrow(ForbiddenException);
    },
  );

  it('requires an explicit branch for an unscoped admin', () => {
    const service = createService();
    expect(() =>
      service.resolveBranch({ userId: 'u1', userType: 'ADMIN' }),
    ).toThrow('branchId is required for ADMIN');
  });

  it('returns a conflict when optimistic ticket update loses the race', async () => {
    const service = createService();
    service.getTicket = jest.fn().mockResolvedValue({
      id: 't1',
      orderId: 'o1',
      branchId: 'b1',
      status: 'WAITING',
    });
    service.tickets = {
      createQueryBuilder: () => ({
        update() {
          return this;
        },
        set() {
          return this;
        },
        where() {
          return this;
        },
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }),
    };
    await expect(
      service.transitionTicket(
        { userId: 'u1', userType: 'KITCHEN', branchId: 'b1' },
        't1',
        1,
        'PREPARING',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('queries tickets without a module feature flag', async () => {
    const service = createService();
    const exist = jest.fn().mockResolvedValue(true);
    service.tickets = { exist };
    await expect(service.hasTicket('o1')).resolves.toBe(true);
    expect(exist).toHaveBeenCalledWith({ where: { orderId: 'o1' } });
  });
});
