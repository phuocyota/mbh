import { traceStatus, portionCount, servingExpiryFromReady, confirmedBatchHandover } from './production-trace.rules';
import {
  consumeBatchLots,
  createFinishedUnits,
} from './production-trace.writer';
import { FinishedUnit } from '../../entities/finished-unit.entity';
import { StockLot, Stock, Product } from '../../entities';

const now = new Date('2026-10-19T06:00:00Z');
describe('production traceability', () => {
  it('sets expiry from READY after 17:00 and across year boundaries', () => {
    expect(servingExpiryFromReady('2026-10-23T17:31:00+07:00', 120)).toBe('2026-10-23T12:31:00.000Z');
    expect(servingExpiryFromReady('2026-12-31T23:30:00+07:00', 90)).toBe('2026-12-31T18:00:00.000Z');
    const expiry = servingExpiryFromReady(new Date('2026-10-23T10:31:00Z'), 120);
    expect(traceStatus('UNIT', 'COMPLETED', expiry, new Date('2026-10-23T12:30:59Z'))).toBe('READY');
    expect(traceStatus('UNIT', 'COMPLETED', expiry, new Date('2026-10-23T12:31:00Z'))).toBe('EXPIRED');
  });
  it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER])(
    'rejects invalid recommended use minutes %s', (minutes) => {
      expect(() => servingExpiryFromReady(now, minutes)).toThrow('INVALID_RECOMMENDED_USE_MINUTES');
    },
  );
  it('rejects a missing or invalid READY instant', () => {
    expect(() => servingExpiryFromReady('invalid', 120)).toThrow('INVALID_BATCH_READY_TIME');
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

describe('Trace status after confirmed handover', () => {
  const expiry = '2026-10-19T05:00:00Z';
  const handedOverAt = '2026-10-19T04:00:00Z';
  it('keeps already handed-over portions and batches in their historical final status', () => {
    expect(traceStatus('UNIT', 'COMPLETED', expiry, now, handedOverAt)).toBe('HANDED_OVER');
    expect(traceStatus('BATCH', 'COMPLETED', expiry, now, handedOverAt)).toBe('HANDED_OVER');
    expect(traceStatus('LOT', '', '2026-10-18', now, handedOverAt)).toBe('EXPIRED');
  });
  it('does not assume completed or transported food has been received', () => {
    expect(traceStatus('UNIT', 'COMPLETED', expiry, now)).toBe('EXPIRED');
    expect(traceStatus('BATCH', 'IN_TRANSIT', expiry, now)).toBe('EXPIRED');
    expect(confirmedBatchHandover({ transport: { dispatchedAt: handedOverAt } }, 'batch', 50)).toBeNull();
    expect(confirmedBatchHandover({ status: 'HANDED_OVER' }, 'batch', 50)).toBeNull();
  });
  it('recognizes only the batch actually handed over in a multi-round ticket', () => {
    const record = { deliveredAt: handedOverAt, receivedBy: 'Cô Lan', items: [{ batchId: 'batch-a', quantity: 50 }] };
    const payload = { partialHandovers: [record], handover: { ...record, items: [{ batchId: 'batch-b', quantity: 10 }] } };
    expect(confirmedBatchHandover(payload, 'batch-a', 50)).toMatchObject({ deliveredAt: handedOverAt, receivedBy: 'Cô Lan' });
    expect(confirmedBatchHandover(payload, 'batch-b', 50)).toBeNull();
    expect(confirmedBatchHandover(payload, 'batch-c', 50)).toBeNull();
    expect(confirmedBatchHandover({ handover: { ...record, deliveredAt: null } }, 'batch-a', 50)).toBeNull();
  });
});
