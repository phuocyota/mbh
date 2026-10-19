import { StockSerialController } from './stock-serial.controller';
import { StockSerialService } from './stock-serial.service';

describe('imported stock serial access', () => {
  it('uses the authenticated branch and rejects cross-branch detail reads', () => {
    const service: any = { list: jest.fn(), detail: jest.fn() };
    const controller = new StockSerialController(service);
    const req = { user: { userType: 'MANAGER', branchId: 'branch' } };
    controller.list(req, {});
    controller.detail(req, 'detail', 1);
    expect(service.list).toHaveBeenCalledWith('branch', {});
    expect(service.detail).toHaveBeenCalledWith('branch', 'detail', 1);
    expect(() => controller.detail(req, 'detail', 1, 'foreign')).toThrow(
      'CROSS_BRANCH_FORBIDDEN',
    );
    expect(service.detail).toHaveBeenCalledTimes(1);
  });
  it('binds search, caps paging and never implies a per-serial stock ledger', async () => {
    const db: any = { query: jest.fn(async () => [{ total: 0, data: [] }]) };
    const result = await new StockSerialService(db).list('branch', {
      search: "' OR true --",
      size: 100000,
    });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).not.toContain("' OR true --");
    expect(params).toEqual(['branch', "%' OR true --%", 100, 0]);
    expect(result).toMatchObject({
      total: 0,
      size: 100,
      serialMovementTrackingSupported: false,
    });
  });
  it.each([
    { stockId: 'bad' },
    { lotId: 'bad' },
    { detailId: 'bad' },
    { position: 0 },
    { position: 1.5 },
    { position: 10001 },
    { serialMode: 'none' },
    { receiptStatus: 'sold' },
    { search: ['bad'] },
  ])('rejects invalid filters %j', async (q) => {
    const db: any = { query: jest.fn() };
    await expect(
      new StockSerialService(db).list('branch', q),
    ).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
  });
  it('does not expose missing or foreign serial details', async () => {
    const db: any = { query: jest.fn(async () => [{ total: 0, data: [] }]) };
    await expect(
      new StockSerialService(db).detail(
        'branch',
        '00000000-0000-4000-8000-000000000001',
        1,
      ),
    ).rejects.toThrow('Không tìm thấy serial');
  });
});
