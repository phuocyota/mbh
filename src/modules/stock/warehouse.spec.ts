import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import {
  warehouseFilters,
  warehouseRange,
  warehouseDate,
} from './warehouse-query';

describe('warehouse query boundaries', () => {
  it('binds every filter value and never interpolates search input into SQL', () => {
    const attack = "' OR true --";
    const result = warehouseFilters(
      {
        search: attack,
        lotCode: attack,
        productType: 'INGREDIENT',
        expiresFrom: '2026-10-01',
        expiresTo: '2026-10-31',
      },
      'branch',
    );
    expect(result.where).not.toContain(attack);
    expect(result.params).toEqual([
      'branch',
      `%${attack}%`,
      'INGREDIENT',
      `%${attack}%`,
      '2026-10-01',
      '2026-10-31',
    ]);
    expect(result.where).toContain('name ILIKE $2 OR code ILIKE $2');
    expect(result.where).toContain('BETWEEN $5::date AND $6::date');
  });
  it.each([
    { stockId: 'invalid' },
    { categoryId: 'bad' },
    { productId: 'bad' },
    { status: 'invented' },
    { productType: 'invented' },
    { expiresFrom: '2026-02-30' },
    { expiresFrom: '2026-10-02', expiresTo: '2026-10-01' },
    { search: ['bad'] },
  ])('rejects malformed filters: %j', (q) => {
    expect(() => warehouseFilters(q, 'branch')).toThrow();
  });
  it('validates calendar dates and bounded historical ranges', () => {
    expect(warehouseDate('2028-02-29', '')).toBe('2028-02-29');
    expect(() => warehouseDate('2026-02-29', '')).toThrow();
    expect(() =>
      warehouseRange({ from: '2024-01-01', to: '2025-12-31' }),
    ).toThrow();
    expect(() =>
      warehouseRange({ from: '2026-10-02', to: '2026-10-01' }),
    ).toThrow();
    expect(() => warehouseRange({ to: '9999-01-01' })).toThrow();
  });
});

describe('warehouse authorization and pagination', () => {
  it('enforces branch from JWT before calling any read service', () => {
    const service: any = {
      overview: jest.fn(),
      inventory: jest.fn(),
      detail: jest.fn(),
      stocks: jest.fn(),
    };
    const controller = new WarehouseController(service);
    const req = { user: { userType: 'MANAGER', branchId: 'branch' } };
    controller.overview(req, {});
    controller.inventory(req, {});
    controller.detail(req, 'product', {});
    controller.stocks(req);
    expect(service.overview).toHaveBeenCalledWith('branch', {});
    expect(service.inventory).toHaveBeenCalledWith('branch', {});
    expect(service.detail).toHaveBeenCalledWith('branch', 'product', {});
    expect(service.stocks).toHaveBeenCalledWith('branch');
    expect(() => controller.inventory(req, { branchId: 'foreign' })).toThrow(
      'CROSS_BRANCH_FORBIDDEN',
    );
    expect(service.inventory).toHaveBeenCalledTimes(1);
  });
  it('caps paging, reports reservation capability honestly, and filters before count', async () => {
    const db: any = { query: jest.fn(async () => [{ total: 3, data: [] }]) };
    const service = new WarehouseService(db);
    const result = await service.inventory('branch', {
      page: -2,
      size: 100000,
      status: 'LOW',
    });
    expect(result).toMatchObject({
      total: 3,
      page: 1,
      size: 100,
      reservationsSupported: false,
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('quantity < "minimumStock"'),
      ['branch', 100, 0],
    );
    expect(db.query.mock.calls[0][0]).toContain('COUNT(*)::int FROM filtered');
  });
});
