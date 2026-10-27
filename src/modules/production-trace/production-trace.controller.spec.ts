import { ProductionTraceController } from './production-trace.controller';
import { FinishedUnit } from '../../entities/finished-unit.entity';
import {
  KitchenProductionBatch,
  KitchenMealPlan,
  Product,
  StockLot,
  Stock,
  StockMovement,
} from '../../entities';

describe('Production trace API scope and labels', () => {
  const actor = { user: { userType: 'KITCHEN', branchId: 'branch' } };
  const unit = {
    id: '3e74b2f9-e45f-4ce2-913a-02e46cedf122',
    branchId: 'branch',
    batchId: 'batch',
    productId: 'dish',
    serial: 1,
    expiresAt: new Date('2099-01-01T00:00:00Z'),
  };
  function harness(branchId = 'branch', expiresAt = unit.expiresAt) {
    const trace: any = { getBatchHandover: jest.fn(async () => null), getFullTrace: jest.fn(async () => ({})) };
    const db: any = {
      getRepository: (type: any) => {
        if (type === FinishedUnit)
          return {
            findOneBy: async () => ({ ...unit, branchId, expiresAt }),
            findAndCount: async () => [[{ ...unit, expiresAt }], 1],
          };
        if (type === KitchenProductionBatch)
          return {
            findOneBy: async () => ({
              id: 'batch',
              productId: 'dish',
              mealPlanId: 'plan',
              status: 'COMPLETED',
              completedAt: new Date(),
              details: {},
            }),
          };
        if (type === KitchenMealPlan)
          return { findOneByOrFail: async () => ({ branchId }) };
        if (type === Product)
          return { findOneBy: async () => ({ name: 'Món ăn' }) };
        if (type === StockMovement) return { createQueryBuilder: () => ({ where() { return this; }, getMany: async () => [] }) };
        if (type === StockLot)
          return { findOneBy: async () => ({ stockId: 'stock' }) };
        if (type === Stock)
          return { findOneByOrFail: async () => ({ branchId }) };
      },
    };
    return { controller: new ProductionTraceController(db, trace), trace };
  }
  it('returns a real printable SVG and stable per-unit payload on reprint', async () => {
    const { controller } = harness();
    const first: any = await controller.labels(actor, 'batch', {});
    const second: any = await controller.labels(actor, 'batch', {});
    const a = first.data[0];
    expect(a.unitId).toBe(unit.id);
    expect(a.qrPayload).toContain(unit.id);
    expect(a.qrSvg).toContain('<svg');
    expect(a.qrSvg).toBe(second.data[0].qrSvg);
    expect(a.status).toBe('READY');
  });
  it('keeps expired-by-clock labels and unit scans handed over after receipt', async () => {
    const { controller, trace } = harness('branch', new Date(0));
    trace.getBatchHandover.mockResolvedValue({ deliveredAt: '2026-10-20T03:00:00Z' });
    expect((await controller.labels(actor, 'batch', {})).data[0].status).toBe('HANDED_OVER');
    expect((await controller.unit(actor, unit.id)).status).toBe('HANDED_OVER');
  });
  it('rejects foreign batch labels and foreign portion scans', async () => {
    const { controller } = harness('foreign');
    await expect(controller.labels(actor, 'batch', {})).rejects.toThrow(
      'CROSS_BRANCH_FORBIDDEN',
    );
    await expect(controller.unit(actor, unit.id)).rejects.toThrow(
      'CROSS_BRANCH_FORBIDDEN',
    );
  });
  it('checks lot scope before invoking comprehensive origin lookup', async () => {
    const { controller, trace } = harness('foreign');
    await expect(controller.lot(actor, 'lot')).rejects.toThrow(
      'CROSS_BRANCH_FORBIDDEN',
    );
    expect(trace.getFullTrace).not.toHaveBeenCalled();
  });
});
