import { planFefo } from './fefo';

describe('FEFO allocation engine', () => {
  const today = '2026-10-20';
  const lot = (id: string, quantity: number, expiresAt: string | null, createdAt = '2026-10-01') => ({ id, quantity, expiresAt, createdAt });
  it('prioritizes expiry, then creation, then ID and puts undated lots last', () => {
    const lots = [lot('undated', 5, null), lot('b', 3, '2026-10-22'), lot('a', 2, '2026-10-22'), lot('early', 1, '2026-10-20'), lot('old', 1, '2026-10-22', '2026-09-01')];
    const before = JSON.stringify(lots);
    const result = planFefo(8, lots, today, 12);
    expect(result.allocations).toEqual([{ lotId: 'early', quantity: 1 }, { lotId: 'old', quantity: 1 }, { lotId: 'a', quantity: 2 }, { lotId: 'b', quantity: 3 }, { lotId: 'undated', quantity: 1 }]);
    expect(result.complete).toBe(true);
    expect(JSON.stringify(lots)).toBe(before);
  });
  it('excludes expired and depleted lots, includes expiry today and reports shortage', () => {
    const result = planFefo(10, [lot('expired', 100, '2026-10-19'), lot('empty', 0, null), lot('today', 3, today)], today, 103);
    expect(result.allocations).toEqual([{ lotId: 'today', quantity: 3 }]);
    expect(result.shortageQuantity).toBe(7);
    expect(result.complete).toBe(false);
  });
  it('caps allocations by aggregate stock balance even if lots report more', () => {
    const result = planFefo(5, [lot('first', 3, today), lot('second', 3, null)], today, 4);
    expect(result.allocations).toEqual([{ lotId: 'first', quantity: 3 }, { lotId: 'second', quantity: 1 }]);
    expect(result.shortageQuantity).toBe(1);
  });
  it('handles four-decimal quantities without a floating-point remainder', () => {
    const result = planFefo(0.3001, [lot('a', 0.1, today), lot('b', 0.2001, null)], today, 0.3001);
    expect(result.allocations).toEqual([{ lotId: 'a', quantity: 0.1 }, { lotId: 'b', quantity: 0.2001 }]);
    expect(result.shortageQuantity).toBe(0);
  });
  it.each([0, -1, NaN, Infinity, 0.00001, Number.MAX_SAFE_INTEGER])('rejects invalid quantity %s', (quantity) => {
    expect(() => planFefo(quantity, [], today, 0)).toThrow();
  });
});
