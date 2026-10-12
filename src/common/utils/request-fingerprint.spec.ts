import { requestFingerprint } from './request-fingerprint';
describe('request fingerprint across JSONB persistence', () => {
  it('ignores JSON key order but preserves changed quantities and lot order', () => {
    const a = {
      requestId: 'r',
      items: [
        {
          quantity: 3,
          productId: 'p',
          allocations: [{ quantity: 3, lotId: 'l' }],
        },
      ],
    };
    const b = {
      items: [
        {
          allocations: [{ lotId: 'l', quantity: 3 }],
          productId: 'p',
          quantity: 3,
        },
      ],
      requestId: 'r',
    };
    expect(requestFingerprint(a)).toBe(requestFingerprint(b));
    expect(
      requestFingerprint({ ...b, items: [{ ...b.items[0], quantity: 4 }] }),
    ).not.toBe(requestFingerprint(a));
  });
});
