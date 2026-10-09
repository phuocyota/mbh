import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  convertQuantity,
  localDate,
  positive,
  StockMovementService,
  validateAllocations,
} from './stock-movement.service';
import { Product, StockItem, StockLot, StockMovement } from '../../entities';

describe('lot stock invariants', () => {
  const unit = (dimension: string, factorToBase: number) => ({
    dimension,
    factorToBase,
  });
  it('converts kg to g without converting unrelated dimensions', () => {
    expect(convertQuantity(2.5, unit('MASS', 1000), unit('MASS', 1))).toBe(
      2500,
    );
    expect(() =>
      convertQuantity(1, unit('MASS', 1000), unit('VOLUME', 1)),
    ).toThrow(BadRequestException);
  });
  it('uses Bangkok date at the UTC date boundary', () =>
    expect(localDate(new Date('2026-10-07T18:00:00Z'))).toBe('2026-10-08'));
  it('rejects invalid, zero and negative quantities', () => {
    for (const n of [NaN, Infinity, -1, 0, null, undefined, '', true])
      expect(() => positive(n)).toThrow();
    expect(positive(0, true)).toBe(0);
  });
  const lots = [
    { id: 'l1', quantity: 10, expiresAt: '2026-10-08' },
    { id: 'l2', quantity: 5, expiresAt: '2026-10-07' },
  ] as StockLot[];
  it('requires explicit selection and exact allocation sum', () => {
    expect(() => validateAllocations(2, [], '2026-10-08', lots)).toThrow(
      'LOT_ALLOCATION_REQUIRED',
    );
    expect(() =>
      validateAllocations(
        2,
        [{ lotId: 'l1', quantity: 1 }],
        '2026-10-08',
        lots,
      ),
    ).toThrow('LOT_ALLOCATION_MISMATCH');
  });
  it('rejects wrong stock, repeated lots, expired lots and shortages', () => {
    expect(() =>
      validateAllocations(
        1,
        [{ lotId: 'other', quantity: 1 }],
        '2026-10-08',
        lots,
      ),
    ).toThrow('LOT_NOT_IN_STOCK');
    expect(() =>
      validateAllocations(
        2,
        [
          { lotId: 'l1', quantity: 1 },
          { lotId: 'l1', quantity: 1 },
        ],
        '2026-10-08',
        lots,
      ),
    ).toThrow('DUPLICATE_LOT');
    expect(() =>
      validateAllocations(
        1,
        [{ lotId: 'l2', quantity: 1 }],
        '2026-10-08',
        lots,
      ),
    ).toThrow('LOT_EXPIRED');
    expect(() =>
      validateAllocations(
        11,
        [{ lotId: 'l1', quantity: 11 }],
        '2026-10-08',
        lots,
      ),
    ).toThrow('LOT_STOCK_SHORTAGE');
    expect(() =>
      validateAllocations(
        1,
        [{ lotId: 'l2', quantity: 1 }],
        '2026-10-08',
        lots,
        true,
      ),
    ).not.toThrow();
  });
  it('recounts every lot with the total and rejects stale or incomplete counts', async () => {
    const row = { quantity: 10 };
    const lot = { id: 'lot', quantity: 10 };
    const movements = { save: jest.fn() };
    const m: any = {
      query: jest.fn(),
      save: jest.fn(async (r) => r),
      getRepository: (target) =>
        target === Product
          ? { findOneByOrFail: async () => ({ lotTrackingEnabled: true }) }
          : target === StockItem
            ? { findOne: async () => row }
            : target === StockLot
              ? { find: async () => [lot] }
              : movements,
    };
    const service = new StockMovementService();
    await expect(
      service.recount(
        m,
        's',
        'p',
        9,
        7,
        [{ lotId: 'lot', actualQuantity: 7 }],
        'count',
      ),
    ).rejects.toThrow('STOCK_CHANGED_SINCE_COUNT');
    await expect(
      service.recount(m, 's', 'p', 10, 7, [], 'count'),
    ).rejects.toThrow('ALL_LOT_COUNTS_REQUIRED');
    await expect(
      service.recount(
        m,
        's',
        'p',
        10,
        7,
        [{ lotId: 'lot', actualQuantity: 8 }],
        'count',
      ),
    ).rejects.toThrow('LOT_COUNT_MISMATCH');
    expect(row.quantity).toBe(10);
    await service.recount(
      m,
      's',
      'p',
      10,
      7,
      [{ lotId: 'lot', actualQuantity: 7 }],
      'count',
      'actor',
    );
    expect(row.quantity).toBe(7);
    expect(lot.quantity).toBe(7);
    expect(movements.save).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: 'count',
        quantity: -3,
        createdBy: 'actor',
      }),
    );
  });
  it('updates total, selected lot and movement together using supplied manager', async () => {
    const total = { stockId: 's', productId: 'p', quantity: 10 },
      lot = {
        id: 'l',
        stockId: 's',
        productId: 'p',
        quantity: 10,
        expiresAt: '2099-01-01',
      };
    const itemRepo = {
        findOne: jest.fn(async () => total),
        save: jest.fn(async (r) => r),
      },
      lotRepo = {
        find: jest.fn(async () => [lot]),
        save: jest.fn(async (r) => r),
      },
      movementRepo = { save: jest.fn() };
    const m: any = {
      query: jest.fn(),
      getRepository: (target: any) =>
        target === Product
          ? { findOneBy: async () => ({ lotTrackingEnabled: true }) }
          : target === StockItem
            ? itemRepo
            : target === StockLot
              ? lotRepo
              : target === StockMovement
                ? movementRepo
                : null,
      save: jest.fn(async (r) => r),
    };
    const service = new StockMovementService();
    await service.change(m, 's', 'p', -3, 'reference', {
      allocations: [{ lotId: 'l', quantity: 3 }],
    });
    expect(total.quantity).toBe(7);
    expect(lot.quantity).toBe(7);
    expect(movementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lotId: 'l',
        quantity: -3,
        referenceId: 'reference',
      }),
    );
    expect(m.query).toHaveBeenCalled();
    await expect(
      service.change(m, 's', 'p', -8, 'other', {
        allocations: [{ lotId: 'l', quantity: 8 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(total.quantity).toBe(7);
  });
});
