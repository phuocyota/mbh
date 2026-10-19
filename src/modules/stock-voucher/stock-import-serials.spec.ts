import { prepareImportSerials } from './stock-import-serials';

describe('stock import serials', () => {
  const item = { productId: 'product', quantity: 2 };
  it('keeps existing imports without serials working', () => {
    expect(prepareImportSerials(item, 'IMPORT', 2)).toEqual({
      serialMode: 'NONE',
      serials: [],
    });
  });
  it('trims manual serials and preserves their order', () => {
    expect(
      prepareImportSerials(
        { ...item, serialMode: 'MANUAL', serials: [' A ', 'B'] },
        'IMPORT',
        2,
      ).serials,
    ).toEqual(['A', 'B']);
  });
  it.each([['A'], ['A', 'A '], ['', 'B'], ['a'.repeat(129), 'B']])(
    'rejects invalid serial lists: %j',
    (...serials) => {
      expect(() =>
        prepareImportSerials(
          { ...item, serialMode: 'MANUAL', serials },
          'IMPORT',
          2,
        ),
      ).toThrow();
    },
  );
  it('generates distinct identities per unit and per import', () => {
    const first = prepareImportSerials(
      { ...item, serialMode: 'AUTO' },
      'IMPORT',
      2,
    );
    const second = prepareImportSerials(
      { ...item, serialMode: 'AUTO' },
      'IMPORT',
      2,
    );
    expect(new Set([...first.serials, ...second.serials]).size).toBe(4);
    expect(
      first.serials.every((serial) => /^[0-9a-f-]{36}$/.test(serial)),
    ).toBe(true);
  });
  it.each([0, 1.5, 10001, 20])(
    'rejects invalid or converted quantities: %s',
    (quantity) => {
      expect(() =>
        prepareImportSerials(
          { ...item, serialMode: 'AUTO' },
          'IMPORT',
          quantity,
        ),
      ).toThrow();
    },
  );
  it('rejects serials sent in the wrong mode or for exports', () => {
    for (const serialMode of ['NONE', 'AUTO'] as const)
      expect(() =>
        prepareImportSerials(
          { ...item, serialMode, serials: ['A', 'B'] },
          'IMPORT',
          2,
        ),
      ).toThrow();
    expect(() =>
      prepareImportSerials({ ...item, serialMode: 'AUTO' }, 'EXPORT', 2),
    ).toThrow();
  });
});
