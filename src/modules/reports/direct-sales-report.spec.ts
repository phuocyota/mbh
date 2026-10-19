import { ReportsService } from './reports.service';
import { DIRECT_SALES_SQL, mergeProductSales } from './direct-sales-report';

const manual = {
  voucherId: 'export-1',
  employeeId: 'seller-1',
  employee: 'Nhân viên 1',
  productId: 'product-1',
  date: '2026-10-19',
  code: 'SP1',
  name: 'Sữa',
  unit: 'Hộp',
  qty: 2,
  total: 40000,
  cost: 20000,
  method: 'CASH',
};

function harness() {
  const orders = {
    getRevenueSummaryRows: jest.fn().mockResolvedValue({
      totalRow: { orderCount: '1', totalRevenue: '10000' },
      refundedRow: { refundAmount: '1000' },
    }),
    getEmployeeSalesRows: jest.fn().mockResolvedValue([
      {
        id: 'seller-2',
        employee: 'Nhân viên 2',
        orders: '1',
        revenue: '10000',
        totalAmount: '10000',
      },
    ]),
    getDailyRevenueRows: jest
      .fn()
      .mockResolvedValue([
        { day: '2026-10-19', orderCount: '1', revenue: '10000' },
      ]),
  };
  const items = {
    getEndOfDayItems: jest.fn().mockResolvedValue([]),
    getTopProducts: jest.fn().mockResolvedValue([
      {
        productId: 'product-1',
        productName: 'Sữa',
        totalQuantity: '1',
        totalRevenue: '20000',
      },
    ]),
    getBottomProducts: jest.fn().mockResolvedValue([]),
    getMonthlyOrderPlanRows: jest.fn().mockResolvedValue([
      {
        productId: 'product-1',
        code: 'SP1',
        name: 'Sữa',
        unit: 'Hộp',
        groupName: 'Đồ uống',
        monthlyUsage: '1',
        revenue: '20000',
        branchId: 'branch-1',
        branchName: 'Chi nhánh 1',
      },
    ]),
    getEmployeeCashierRows: jest.fn().mockResolvedValue([]),
    getEmployeeProfitRows: jest.fn().mockResolvedValue([]),
  };
  const repo = {
    query: jest
      .fn()
      .mockResolvedValue([
        manual,
        { ...manual, productId: 'product-2', code: 'SP2' },
      ]),
  };
  const payments = {
    getPaymentBreakdown: jest
      .fn()
      .mockResolvedValue([{ method: 'CASH', amount: '10000', count: '1' }]),
  };
  const service = new ReportsService(
    orders as any,
    items as any,
    payments as any,
    {} as any,
    {} as any,
    repo as any,
    {} as any,
    {} as any,
  );
  jest
    .spyOn(service as any, 'getStockOnHandByProduct')
    .mockResolvedValue([{ productId: 'product-1', quantity: '1' }]);
  return { service, orders, items, repo };
}

describe('Direct sales in reports', () => {
  const query = { from: '2026-10-19', to: '2026-10-19', branchId: 'branch-1' };
  it('feeds direct sales into the existing Usage, stock and Min/Max form', async () => {
    const { service } = harness();
    const report = await service.monthlyOrderPlan(query);
    expect(report.revenueMonth).toBe(90000);
    expect(
      report.data.find((row) => row.productId === 'product-1'),
    ).toMatchObject({
      monthlyUsage: 3,
      stockOnHand: 1,
      planSales: { min: 4, max: 5 },
      suggestedOrderQuantity: 4,
    });
    expect(
      report.data.find((row) => row.productId === 'product-2'),
    ).toMatchObject({ monthlyUsage: 2 });
  });
  it('adds revenue but counts a multi-line export only once', async () => {
    const { service, repo } = harness();
    const report = await service.revenueSummary(query);
    expect(report).toMatchObject({
      orderCount: 2,
      totalRevenue: 90000,
      netRevenue: 89000,
    });
    expect(report.paymentBreakdown).toEqual([
      { method: 'CASH', count: 2, amount: 90000 },
    ]);
    expect(repo.query).toHaveBeenCalledWith(DIRECT_SALES_SQL, [
      '2026-10-18T17:00:00.000Z',
      '2026-10-19T16:59:59.999Z',
      'branch-1',
    ]);
  });
  it('adds export lines to end-of-day without inventing VAT data', async () => {
    const { service } = harness();
    const report = await service.endOfDay(query);
    expect(report.data).toHaveLength(2);
    expect(report.data[0]).toMatchObject({
      price: 20000,
      qty: 2,
      total: 40000,
      tax: null,
      net: null,
    });
  });
  it('ranks products after combining both sale sources', async () => {
    const { service, items } = harness();
    const result = await service.topProducts({ ...query, limit: 1 });
    expect(items.getTopProducts).toHaveBeenCalledWith(
      expect.objectContaining({ limit: undefined }),
    );
    expect(result).toEqual([
      {
        productId: 'product-1',
        productName: 'Sữa',
        totalQuantity: 3,
        totalRevenue: 60000,
      },
    ]);
  });
  it('adds daily revenue without counting each exported line as an invoice', async () => {
    const { service } = harness();
    const report = await service.revenueDaily(query);
    expect(report.data).toEqual([
      { day: '2026-10-19', orderCount: 2, revenue: 90000 },
    ]);
  });
  it('attributes direct sales to their creator and preserves the employee picker after filtering', async () => {
    const { service } = harness();
    const report = await service.employeeReport({
      ...query,
      employeeId: 'seller-1',
    });
    expect(report.sales).toEqual([
      expect.objectContaining({ id: 'seller-1', orders: 1, revenue: 80000 }),
    ]);
    expect(report.summary).toMatchObject({
      revenue: 80000,
      quantity: 4,
      cost: 40000,
      profit: 40000,
    });
    expect(report.employees.map((row) => row.id)).toEqual([
      'seller-1',
      'seller-2',
    ]);
  });
  it('merges quantities before applying the low-sales cutoff', () => {
    const result = mergeProductSales(
      [
        {
          productId: 'product-1',
          productName: 'Sữa',
          totalQuantity: 1,
          totalRevenue: 20000,
        },
      ],
      [manual, { ...manual, productId: 'product-2', qty: 1 }],
      1,
      true,
    );
    expect(result[0].productId).toBe('product-2');
  });
  it('only queries completed standalone sales, excluding order exports and unrelated stock movements', () => {
    expect(DIRECT_SALES_SQL).toContain("e.status = 'COMPLETED'");
    expect(DIRECT_SALES_SQL).toContain(
      "e.reason_code IN ('BH_CASH', 'BH_BANK')",
    );
    expect(DIRECT_SALES_SQL).toContain(
      "LOWER(COALESCE(e.reference_type, '')) <> 'order'",
    );
    expect(DIRECT_SALES_SQL).toContain('NOT EXISTS (SELECT 1 FROM orders');
  });
});
