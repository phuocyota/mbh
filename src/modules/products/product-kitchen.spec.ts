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
  it('classifies a cooking flag as a finished good without changing stock', async () => {
    const h = harness({ productType: null, baseUnitId: null });
    await h.service.updateProduct('product', { requiresCooking: true });
    expect(h.product).toMatchObject({
      requiresCooking: true,
      productType: 'FINISHED_GOOD',
    });
    expect(h.product.quantity).toBeUndefined();
  });
  it('rejects a cooking flag on raw materials', async () => {
    await expect(
      harness().service.updateProduct('product', {
        requiresCooking: true,
        productType: 'INGREDIENT',
      }),
    ).rejects.toThrow('FINISHED_GOOD');
  });
  it('preserves material classification when its cooking flag is false', async () => {
    const h = harness();
    await h.service.updateProduct('product', { requiresCooking: false });
    expect(h.product.productType).toBe('INGREDIENT');
  });
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
  it('stores product checkboxes independently and allows all to be false', async () => {
    const h = harness();
    await h.service.updateProduct('product', {
      isCanteenItem: true,
      isBoarding: true,
      isFreshFood: true,
    });
    expect(h.product).toMatchObject({
      isCanteenItem: true,
      isBoarding: true,
      isFreshFood: true,
    });
    await h.service.updateProduct('product', {
      isCanteenItem: false,
      isBoarding: false,
      isFreshFood: false,
    });
    expect(h.product).toMatchObject({
      isCanteenItem: false,
      isBoarding: false,
      isFreshFood: false,
    });
    await h.service.updateProduct('product', { isBoarding: true });
    expect(h.product).toMatchObject({
      isCanteenItem: false,
      isBoarding: true,
      isFreshFood: false,
    });
  });
  it('stores and clears the minimum stock without changing stock balances', async () => {
    const h = harness();
    await h.service.updateProduct('product', { minimumStock: 10 });
    expect(h.product.minimumStock).toBe(10);
    await h.service.updateProduct('product', { clearMinimumStock: true });
    expect(h.product.minimumStock).toBeNull();
    expect(h.product.quantity).toBeUndefined();
  });
  it('persists the fresh food flag and allows switching it off', async () => {
    const h = harness();
    await h.service.updateProduct('product', { isFreshFood: true });
    expect(h.product.isFreshFood).toBe(true);
    await h.service.updateProduct('product', { isFreshFood: false });
    expect(h.product.isFreshFood).toBe(false);
  });
  it('requires an explicit base unit on newly created materials', async () => {
    await expect(
      harness().service.createProduct({ name: 'Fuel', productType: 'FUEL' }),
    ).rejects.toThrow('PRODUCT_BASE_UNIT_REQUIRED');
  });
});
