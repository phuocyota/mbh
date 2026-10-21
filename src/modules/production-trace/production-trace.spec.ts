import { traceStatus, portionCount, defaultServingExpiry } from './production-trace.rules';
import {
  consumeBatchLots,
  createFinishedUnits,
} from './production-trace.writer';
import { FinishedUnit } from '../../entities/finished-unit.entity';
import { StockLot, Stock, Product } from '../../entities';

const now = new Date('2026-10-19T06:00:00Z');
describe('production traceability', () => {
  it('sets 17:00 Vietnam on the production date, including month/year boundaries', () => {
    expect(defaultServingExpiry('2026-10-21')).toBe('2026-10-21T10:00:00.000Z');
    expect(defaultServingExpiry('2026-12-31')).toBe('2026-12-31T10:00:00.000Z');
    expect(() => defaultServingExpiry('2026-02-30')).toThrow('INVALID_PRODUCTION_DATE');
    const expiry = defaultServingExpiry('2026-10-21');
    expect(traceStatus('UNIT', 'COMPLETED', expiry, new Date('2026-10-21T09:59:59Z'))).toBe('READY');
    expect(traceStatus('UNIT', 'COMPLETED', expiry, new Date('2026-10-21T10:00:00Z'))).toBe('EXPIRED');
  });
  it('keeps date-only materials usable through the expiry day in local time', () => {
    expect(traceStatus('LOT', '', '2026-10-19', now)).toBe('IN STOCK');
    expect(traceStatus('LOT', '', '2026-10-18', now)).toBe('EXPIRED');
  });
  it('maps production states and expires finished portions at the exact instant', () => {
    expect(traceStatus('BATCH', 'WAITING', null, now)).toBe('IN STOCK');
    expect(traceStatus('BATCH', 'PREPARING', null, now)).toBe('MAKE');
    expect(traceStatus('BATCH', 'READY', '2026-10-19T07:00:00Z', now)).toBe(
      'READY',
    );
    expect(traceStatus('UNIT', 'COMPLETED', now, now)).toBe('EXPIRED');
  });
  it.each([1.5, -1, NaN, Infinity, 10001])(
    'rejects unprintable portion count %s',
    (q) => {
      expect(() => portionCount(q)).toThrow();
    },
  );
  it('consumes actual lot quantities against the batch reference and base units', async () => {
    const batch: any = { id: 'batch', details: {} };
    const lot = { id: 'lot', stockId: 'stock', productId: 'ingredient' };
    const m: any = {
      getRepository: (type: any) => ({
        findOneBy: async () =>
          type === StockLot
            ? lot
            : type === Stock
              ? { branchId: 'branch' }
              : { lotTrackingEnabled: true, productType: 'INGREDIENT' },
      }),
    };
    const movements: any = { lockProducts: jest.fn(), change: jest.fn() };
    await consumeBatchLots(
      m,
      movements,
      batch,
      'branch',
      [{ lotId: 'lot', quantity: 2.5 }],
      'staff',
    );
    expect(movements.change).toHaveBeenCalledWith(
      m,
      'stock',
      'ingredient',
      -2.5,
      'batch',
      {
        allocations: [{ lotId: 'lot', quantity: 2.5 }],
        actorId: 'staff',
      },
    );
    expect(batch.details.traceabilityVersion).toBe(1);
  });
  it('rejects other-branch inputs before changing stock', async () => {
    const movements: any = { lockProducts: jest.fn(), change: jest.fn() };
    const m: any = {
      getRepository: (type: any) => ({
        findOneBy: async () =>
          type === StockLot
            ? { stockId: 'foreign', productId: 'ingredient' }
            : type === Product
              ? { lotTrackingEnabled: true }
              : null,
      }),
    };
    await expect(
      consumeBatchLots(
        m,
        movements,
        { details: {} } as any,
        'branch',
        [{ lotId: 'lot', quantity: 1 }],
        'staff',
      ),
    ).rejects.toThrow('INVALID_BATCH_INPUT_LOT');
    expect(movements.change).not.toHaveBeenCalled();
  });
  it('does not create QR identities for an expired batch', async () => {
    await expect(
      createFinishedUnits(
        {} as any,
        {
          actualQuantity: 1,
          details: { servingExpiresAt: '2000-01-01T00:00:00Z' },
        } as any,
        'branch',
        'staff',
      ),
    ).rejects.toThrow('FINISHED_BATCH_EXPIRED_OR_EXPIRY_MISSING');
  });
  it('creates one distinct immutable identity per portion, with its expiry', async () => {
    const repo = { countBy: jest.fn(async () => 0), insert: jest.fn() };
    const m: any = {
      getRepository: (type: any) => {
        expect(type).toBe(FinishedUnit);
        return repo;
      },
    };
    const batch: any = {
      id: 'batch',
      productId: 'dish',
      actualQuantity: 3,
      details: { servingExpiresAt: '2099-01-01T00:00:00Z' },
    };
    await createFinishedUnits(m, batch, 'branch', 'staff');
    const records = repo.insert.mock.calls[0][0] as any[];
    expect(records.map((r) => r.serial)).toEqual([1, 2, 3]);
    expect(new Set(records.map((r) => r.id)).size).toBe(3);
    expect(
      records.every((r) => r.batchId === 'batch' && r.branchId === 'branch'),
    ).toBe(true);
    expect(batch.details.finishedUnitCount).toBe(3);
    repo.countBy.mockResolvedValueOnce(3);
    await expect(
      createFinishedUnits(m, batch, 'branch', 'staff'),
    ).rejects.toThrow('FINISHED_UNITS_ALREADY_CREATED');
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });
});
