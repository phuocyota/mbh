import { hasKitchenSample, kitchenSamplePolicy } from './kitchen-sample.rules';

describe('Kitchen sample policy', () => {
  it.each([1, 30, 31])('always requires an actual photo for boarding production of %i', (quantity) => {
    expect(kitchenSamplePolicy({ requiresSample: false }, {
      source: 'BOARDING', plannedQuantity: 100, actualQuantity: quantity,
    })).toEqual({ requiresSample: quantity > 30, requiresImage: true });
  });
  const batch = {
    id: 'batch2',
    productId: 'dish',
    startedAt: '2026-10-20T03:00:00Z',
    details: { workflowTicketId: 'ticket' },
  };
  const sample = {
    parentId: 'batch1',
    date: '2026-10-20',
    payload: {
      productId: 'dish',
      quantity: 100,
      sampledAt: '2026-10-19T18:00:00Z',
    },
  };
  it('reuses the same dish sample in the Vietnam local day for subsequent sale batches', () => {
    expect(hasKitchenSample([sample], batch, '2026-10-20')).toBe(true);
  });
  it('does not reuse a different dish, previous day sample or malformed timestamp', () => {
    expect(
      hasKitchenSample(
        [sample],
        { ...batch, productId: 'other' },
        '2026-10-20',
      ),
    ).toBe(false);
    expect(hasKitchenSample([sample], batch, '2026-10-21')).toBe(false);
    expect(
      hasKitchenSample(
        [{ ...sample, payload: { ...sample.payload, sampledAt: 'bad' } }],
        batch,
        '2026-10-20',
      ),
    ).toBe(false);
  });
  it('does not reuse another batch sample for planned production', () => {
    expect(
      hasKitchenSample([sample], { ...batch, details: {} }, '2026-10-20'),
    ).toBe(false);
  });
  it.each([1, 30, 31])(
    'requires a sample for a canteen sale batch of %i',
    (quantity) => {
      expect(
        kitchenSamplePolicy(
          { requiresSample: false },
          {
            plannedQuantity: quantity,
            details: { workflowTicketId: 'ticket' },
          },
        ),
      ).toEqual({ requiresSample: true, requiresImage: false });
    },
  );
  it.each([29, 30])(
    'does not force a sample or photo on a plan batch of %i',
    (quantity) => {
      expect(kitchenSamplePolicy({}, { actualQuantity: quantity })).toEqual({
        requiresSample: false,
        requiresImage: false,
      });
    },
  );
  it('requires both sample and actual photo above 30 even when the product flag is off', () => {
    expect(
      kitchenSamplePolicy({ requiresSample: false }, { actualQuantity: 31 }),
    ).toEqual({ requiresSample: true, requiresImage: true });
  });
  it('uses adjustments before actual yield is recorded and actual yield afterwards', () => {
    const batch = { plannedQuantity: 30, adjustmentQuantity: 1 };
    expect(kitchenSamplePolicy({}, batch).requiresImage).toBe(true);
    expect(
      kitchenSamplePolicy({}, { ...batch, actualQuantity: 30 }).requiresImage,
    ).toBe(false);
  });
  it('preserves the explicit product sample requirement for small planned batches', () => {
    expect(
      kitchenSamplePolicy({ requiresSample: true }, { actualQuantity: 1 }),
    ).toEqual({ requiresSample: true, requiresImage: false });
  });
});
