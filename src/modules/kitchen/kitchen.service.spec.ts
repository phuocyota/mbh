import { ConflictException, ForbiddenException } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { DataSource } from 'typeorm';

function createService() {
  const service = Object.create(KitchenService.prototype);
  service.config = {
    get: jest.fn().mockReturnValue(undefined),
  };
  service.tickets = { find: jest.fn().mockResolvedValue([]) };
  service.dataSource = {
    getRepository: () => ({ findOneBy: jest.fn().mockResolvedValue(null) }),
  };
  return service as KitchenService & Record<string, any>;
}

describe('KitchenService authorization and concurrency', () => {
  it('does not count a ticket again through its generated production batch', async () => {
    const service = createService();
    service.mealPlans = {
      find: jest.fn().mockResolvedValue([
        {
          batches: [
            {
              productId: 'bread',
              plannedQuantity: 1,
              adjustmentQuantity: 0,
              details: { workflowTicketId: 'ticket' },
            },
          ],
        },
      ]),
    };
    const builder: any = {};
    for (const method of ['innerJoinAndSelect', 'where', 'andWhere'])
      builder[method] = jest.fn().mockReturnValue(builder);
    builder.getMany = jest
      .fn()
      .mockResolvedValue([{ items: [{ productId: 'bread', quantity: 1 }] }]);
    service.tickets = { createQueryBuilder: () => builder };
    service.recipes = {
      findOne: jest.fn().mockResolvedValue({
        yieldQuantity: 1,
        items: [
          {
            ingredientProductId: 'pork',
            quantity: 50,
            unit: { dimension: 'MASS', factorToBase: 1 },
            ingredientProduct: { baseUnitId: 'g' },
          },
        ],
      }),
    };
    service.units = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'g', dimension: 'MASS', factorToBase: 1 }),
    };
    expect(
      await (service as any).calculateDemand('b', '2026-10-20', ''),
    ).toEqual([{ productId: 'pork', quantity: 50, unitId: 'g' }]);
  });
  it.each([123, {}, 'a'.repeat(501)])(
    'rejects invalid recipe descriptions before writing (%p)',
    async (description) => {
      await expect(
        createService().createRecipe(
          { userId: 'u', userType: 'HEAD_CHEF', branchId: 'b' },
          { description },
        ),
      ).rejects.toThrow('500 ký tự');
    },
  );

  it.each([
    [
      '  Bánh mì gồm vỏ bánh, chả và rau.  ',
      'Bánh mì gồm vỏ bánh, chả và rau.',
    ],
    ['', null],
    [undefined, null],
  ])(
    'stores a trimmed optional recipe introduction (%p)',
    async (description, expected) => {
      const service = createService();
      const product = {
        id: 'bread',
        branchId: 'b',
        productType: 'FINISHED_GOOD',
        baseUnitId: null,
      };
      const ingredient = {
        id: 'roll',
        branchId: 'b',
        productType: 'INGREDIENT',
        baseUnitId: 'piece',
      };
      const unit = { id: 'piece', dimension: 'COUNT', factorToBase: 1 };
      service.products = {
        findOne: jest.fn().mockResolvedValue(product),
        find: jest.fn().mockResolvedValue([ingredient]),
      };
      service.units = {
        findOne: jest.fn().mockResolvedValue(unit),
        find: jest.fn().mockResolvedValue([unit]),
      };
      let saved: any;
      const manager: any = {
        getRepository: (entity) =>
          entity.name === 'Product'
            ? { find: jest.fn().mockResolvedValue([product, ingredient]) }
            : {
                findOne: jest.fn().mockResolvedValue(null),
                findBy: jest.fn().mockResolvedValue([]),
              },
        create: (_entity, value) => ({ ...value }),
        save: async (entity, value) => {
          if (entity.name === 'KitchenRecipe')
            saved = { id: 'recipe', ...value };
          return saved || value;
        },
        findOne: jest.fn(async () => saved),
      };
      service.dataSource = { manager, transaction: async (fn) => fn(manager) };
      service.operations = { lock: jest.fn() };
      service.movements = { lockProducts: jest.fn() };
      const recipe = await service.createRecipe(
        { userId: 'u', userType: 'HEAD_CHEF', branchId: 'b' },
        {
          productId: 'bread',
          yieldQuantity: 1,
          yieldUnitId: 'piece',
          description,
          items: [
            { ingredientProductId: 'roll', quantity: 1, unitId: 'piece' },
          ],
        },
      );
      expect(recipe.description).toBe(expected);
      expect(recipe.version).toBe(1);
    },
  );
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
      find: jest.fn().mockResolvedValue([
        {
          id: 't1',
          status: 'WAITING',
          order: { orderCode: 'TEST', orderNumber: 123 },
          items: [{ productId: 'bread', productName: 'Bánh mì', quantity: 1 }],
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
  it('returns sample requirements for plan and sale batches using authenticated branch scope', async () => {
    const service = createService();
    const findPlans = jest.fn().mockResolvedValue([{
      planDate: '2026-10-20', batches: [
        { id: 'plan-batch', productId: 'dish', plannedQuantity: 31, startedAt: '2026-10-20T01:00:00Z' },
        { id: 'sale-batch', productId: 'dish', plannedQuantity: 1, startedAt: '2026-10-20T02:00:00Z', details: { workflowTicketId: 'ticket' } },
      ],
    }]);
    service.mealPlans = { find: findPlans };
    service.products = { find: jest.fn().mockResolvedValue([{ id: 'dish', requiresSample: false }]) };
    const findSamples = jest.fn().mockResolvedValue([{
      parentId: 'plan-batch', payload: { quantity: 100, sampledAt: '2026-10-20T01:30:00Z' },
    }]);
    service.dataSource = { getRepository: () => ({ find: findSamples }) };
    const result = await service.getMealPlans(
      { userId: 'u', userType: 'KITCHEN', branchId: 'branch1' },
      { date: '2026-10-20', includeSampleStatus: 'true' },
    );
    expect(findPlans).toHaveBeenCalledWith(expect.objectContaining({ where: { branchId: 'branch1', planDate: '2026-10-20' } }));
    expect(findSamples).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branchId: 'branch1', kind: 'samples' }) }));
    expect(result[0].batches).toEqual([
      expect.objectContaining({ id: 'plan-batch', requiresSample: true, requiresImage: true, hasValidSample: true }),
      expect.objectContaining({ id: 'sale-batch', requiresSample: true, requiresImage: false, hasValidSample: false }),
    ]);
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
      remainingOnly: true,
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
