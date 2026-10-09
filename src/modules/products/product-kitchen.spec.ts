import { ProductService } from './product.service';

function harness(productOverrides: any = {}) {
  const product: any = {
    id: 'product',
    name: 'Material',
    productType: 'INGREDIENT',
    baseUnitId: 'g',
    unit: 'g',
    lotTrackingEnabled: false,
    price: 0,
    costPrice: 0,
    ...productOverrides,
  };
  const repo: any = {
    findOne: jest.fn(async () => product),
    save: jest.fn(async (p) => p),
  };
  const manager: any = {
    query: jest.fn(async (sql) =>
      sql.includes('SELECT code')
        ? [{ code: 'g' }]
        : sql.includes('SELECT EXISTS')
          ? [{ used: true }]
          : [],
    ),
    getRepository: () => repo,
  };
  repo.manager = { ...manager, transaction: async (fn) => fn(manager) };
  const service = new ProductService(
    repo,
    { save: jest.fn() } as any,
    {} as any,
  );
  return { service, repo, product, manager };
}
describe('Product classification and unit boundaries', () => {
  it('blocks classification changes for products with stock, recipes or transactions', async () => {
    const h = harness();
    await expect(
      h.service.updateProduct('product', { productType: 'FUEL' }),
    ).rejects.toThrow('PRODUCT_CLASSIFICATION_IN_USE');
    expect(h.repo.save).not.toHaveBeenCalled();
  });
  it('does not rescale stock when changing the base unit', async () => {
    const h = harness();
    await expect(
      h.service.updateProduct('product', { baseUnitId: 'kg' }),
    ).rejects.toThrow('PRODUCT_CLASSIFICATION_IN_USE');
    expect(h.repo.save).not.toHaveBeenCalled();
  });
  it('allows explicit initial classification and matching legacy unit without importing a quantity', async () => {
    const h = harness({ productType: null, baseUnitId: null });
    await h.service.updateProduct('product', {
      productType: 'INGREDIENT',
      baseUnitId: 'g',
      quantity: 999,
    });
    expect(h.product.productType).toBe('INGREDIENT');
    expect(h.product.baseUnitId).toBe('g');
    expect(h.product.quantity).toBeUndefined();
  });
  it('requires the opening allocation tool to activate tracking', async () => {
    const h = harness();
    await expect(
      h.service.updateProduct('product', { lotTrackingEnabled: true }),
    ).rejects.toThrow('USE_STOCK_LOT_OPENING');
  });
  it('requires an explicit base unit on newly created materials', async () => {
    await expect(
      harness().service.createProduct({ name: 'Fuel', productType: 'FUEL' }),
    ).rejects.toThrow('PRODUCT_BASE_UNIT_REQUIRED');
  });
});
