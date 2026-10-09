import { ConflictException, ForbiddenException } from '@nestjs/common';
import { KitchenOperationsService } from './kitchen-operations.service';
import {
  KitchenOperation,
  KitchenProductionBatch,
  KitchenMealPlan,
  Product,
} from '../../entities';

function harness() {
  const actor = { userId: 'staff', userType: 'KITCHEN', branchId: 'branch' };
  const dish = { requiresSample: true, recommendedUseMinutes: 120 };
  const rows: any[] = [];
  const batch: any = {
    id: 'batch',
    mealPlanId: 'plan',
    productId: 'dish',
    version: 2,
    status: 'READY',
    actualQuantity: null,
    shift: 'Ca trưa',
    startedAt: new Date('2026-10-08T01:00:00Z'),
    details: {},
  };
  const repo: any = {
    findBy: jest.fn(async (where: any) =>
      rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)),
    ),
    find: jest.fn(async () => []),
    findOneBy: jest.fn(async (w: any) =>
      rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)),
    ),
    findOneByOrFail: jest.fn(async (w: any) => {
      const row = rows.find((r) => r.id === w.id);
      if (!row) throw Error('missing');
      return row;
    }),
    save: jest.fn(async (r: any) => {
      if (!r.id) r.id = `doc-${rows.length}`;
      const old = rows.findIndex((x) => x.id === r.id);
      if (old < 0) rows.push(r);
      else rows[old] = r;
      return r;
    }),
    create: (r: any) => r,
  };
  const plan = { id: 'plan', branchId: 'branch', planDate: '2026-10-08' };
  const manager: any = {
    query: jest.fn(),
    getRepository: (t: any) =>
      t === KitchenOperation
        ? repo
        : t === KitchenProductionBatch
          ? { findOne: async () => batch }
          : t === KitchenMealPlan
            ? { findOneByOrFail: async () => plan }
            : t === Product
              ? { findOneByOrFail: async () => dish }
              : null,
    save: jest.fn(async (r: any) => {
      r.version++;
      return r;
    }),
  };
  const db: any = {
    manager,
    getRepository: (t: any) =>
      t === KitchenProductionBatch
        ? { findOneByOrFail: async () => batch }
        : t === KitchenMealPlan
          ? { findOneByOrFail: async () => plan }
          : repo,
    transaction: async (fn: any) => fn(manager),
  };
  const socket: any = {
    emitKitchenBatchUpdated: jest.fn(),
    emitKitchenConsumptionUpdated: jest.fn(),
  };
  const service = new KitchenOperationsService(
    db,
    { get: () => 'true' } as any,
    socket,
  );
  return { actor, rows, batch, repo, manager, service, socket, dish };
}
describe('Kitchen operations boundary rules', () => {
  it('fixes serving expiry at ready time instead of later import or configuration time', async () => {
    const h = harness();
    h.batch.status = 'PREPARING';
    const ready = await h.service.transition(
      h.actor,
      'batch',
      { expectedVersion: 2 },
      'READY',
    );
    const expiry = ready.details.servingExpiresAt;
    expect(Date.parse(expiry) - ready.readyAt.getTime()).toBe(120 * 60000);
    h.dish.recommendedUseMinutes = 1000;
    await h.service.transition(
      h.actor,
      'batch',
      { expectedVersion: ready.version, note: 'Updated later' },
      'UPDATE',
    );
    expect(h.batch.details.servingExpiresAt).toBe(expiry);
  });
  it('rejects cumulative imports above measured actual production', async () => {
    const h = harness();
    h.batch.actualQuantity = 10;
    h.rows.push(
      {
        id: 'import',
        branchId: 'branch',
        kind: 'finished-imports',
        date: '2026-10-08',
        shift: 'Ca trưa',
        status: 'DRAFT',
        payload: { batchId: 'batch', quantity: 3 },
      },
      {
        id: 'previous',
        branchId: 'branch',
        kind: 'finished-imports',
        status: 'CONFIRMED',
        parentId: 'batch',
        payload: { quantity: 8 },
      },
    );
    await expect(
      h.service.action(h.actor, 'finished-imports', 'import', 'confirm'),
    ).rejects.toThrow('IMPORT_EXCEEDS_ACTUAL_QUANTITY');
    expect(h.rows.filter((r) => r.kind === 'finished-inventory')).toHaveLength(
      0,
    );
  });
  it('records partial returns once and keeps them outside usable stock', async () => {
    const h = harness();
    h.rows.push(
      {
        id: 'export',
        branchId: 'branch',
        kind: 'finished-exports',
        date: '2026-10-08',
        shift: 'Ca trưa',
        payload: { quantity: 5, lotId: 'lot' },
      },
      {
        id: 'lot',
        branchId: 'branch',
        kind: 'finished-inventory',
        payload: { availableQuantity: 3, quarantinedQuantity: 0 },
      },
    );
    const dto = { quantity: 2, reason: 'Unused', requestId: 'request' };
    const first = await h.service.action(
      h.actor,
      'finished-exports',
      'export',
      'returns',
      dto,
    );
    const replay = await h.service.action(
      h.actor,
      'finished-exports',
      'export',
      'returns',
      { requestId: 'request', reason: 'Unused', quantity: 2 },
    );
    expect(replay.id).toBe(first.id);
    expect(h.rows.find((r) => r.id === 'lot').payload).toEqual({
      availableQuantity: 3,
      quarantinedQuantity: 2,
    });
    await expect(
      h.service.action(h.actor, 'finished-exports', 'export', 'returns', {
        ...dto,
        quantity: 4,
        requestId: 'second',
      }),
    ).rejects.toThrow('RETURN_EXCEEDS_EXPORT');
  });
  it('does not release quarantined food after expiry', async () => {
    const h = harness();
    h.rows.push({
      id: 'lot',
      branchId: 'branch',
      kind: 'finished-inventory',
      date: '2026-10-08',
      shift: 'Ca trưa',
      payload: {
        expiresAt: '2000-01-01T00:00:00Z',
        availableQuantity: 0,
        quarantinedQuantity: 2,
      },
    });
    await expect(
      h.service.action(
        { ...h.actor, userType: 'MANAGER' },
        'finished-inventory',
        'lot',
        'release',
        { quantity: 1, reason: 'Reviewed', requestId: 'release' },
      ),
    ).rejects.toThrow('FINISHED_LOT_EXPIRED');
  });
  it('allows sample processing as a new event after shift closure', async () => {
    const h = harness();
    h.repo.find.mockResolvedValue([{ status: 'LOCKED' }]);
    h.rows.push({
      id: 'sample',
      branchId: 'branch',
      kind: 'samples',
      date: '2026-10-08',
      shift: 'Ca trưa',
      status: 'STORED',
      payload: { quantity: 100 },
    });
    const result = await h.service.action(
      h.actor,
      'samples',
      'sample',
      'process',
      { reason: 'Storage finished' },
    );
    expect(result.status).toBe('PROCESSED');
    expect(
      h.rows.some((r) => r.kind === 'history' && r.parentId === 'sample'),
    ).toBe(true);
  });
  it('rejects cross-branch access and manager-only actions', () => {
    const h = harness();
    expect(() => h.service.branch(h.actor, 'other')).toThrow(
      ForbiddenException,
    );
    expect(() => h.service.manager(h.actor)).toThrow(ForbiddenException);
  });
  it('does not complete a batch using a stale version', async () => {
    const h = harness();
    await expect(
      h.service.transition(
        h.actor,
        'batch',
        { expectedVersion: 1, actualQuantity: 10 },
        'COMPLETED',
      ),
    ).rejects.toThrow('KITCHEN_BATCH_VERSION_CONFLICT');
    expect(h.manager.save).not.toHaveBeenCalled();
  });
  it('requires measured actual quantity and a valid sample before completing', async () => {
    const h = harness();
    await expect(
      h.service.transition(
        h.actor,
        'batch',
        { expectedVersion: 2 },
        'COMPLETED',
      ),
    ).rejects.toThrow('ACTUAL_QUANTITY_REQUIRED');
    await expect(
      h.service.transition(
        h.actor,
        'batch',
        { expectedVersion: 2, actualQuantity: 10 },
        'COMPLETED',
      ),
    ).rejects.toThrow('SAMPLE_REQUIRED');
    h.rows.push({
      kind: 'samples',
      parentId: 'batch',
      branchId: 'branch',
      payload: { quantity: 100, sampledAt: '2026-10-08T02:00:00Z' },
    });
    const result = await h.service.transition(
      h.actor,
      'batch',
      { expectedVersion: 2, actualQuantity: 10 },
      'COMPLETED',
    );
    expect(result.actualQuantity).toBe(10);
    expect(result.status).toBe('COMPLETED');
    expect(h.socket.emitKitchenBatchUpdated).toHaveBeenCalled();
  });
  it('protects actual production already imported', async () => {
    const h = harness();
    h.rows.push({
      kind: 'finished-imports',
      parentId: 'batch',
      branchId: 'branch',
      status: 'CONFIRMED',
      payload: { quantity: 8 },
    });
    await expect(
      h.service.transition(
        h.actor,
        'batch',
        { expectedVersion: 2, actualQuantity: 7 },
        'UPDATE',
      ),
    ).rejects.toThrow('ACTUAL_BELOW_IMPORTED');
  });
  it('blocks writes to confirmed or locked shifts', async () => {
    const h = harness();
    h.repo.find.mockResolvedValue([{ status: 'LOCKED' }]);
    await expect(
      h.service.unlocked(h.manager, 'branch', '2026-10-08', 'Ca trưa'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
