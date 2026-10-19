import { ReportsService } from './reports.service';

function harness() {
  const orders = {
    getRevenueSummaryRows: jest
      .fn()
      .mockResolvedValue({ totalRow: { totalRevenue: 10000 } }),
  };
  const items = {
    getTopProducts: jest.fn().mockResolvedValue([]),
    getBottomProducts: jest.fn().mockResolvedValue([]),
    getMonthlyOrderPlanRows: jest.fn().mockResolvedValue([]),
  };
  const payments = { getPaymentBreakdown: jest.fn().mockResolvedValue([]) };
  const service = new ReportsService(
    orders as any,
    items as any,
    payments as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  jest.spyOn(service as any, 'getStockOnHandByProduct').mockResolvedValue([]);
  return { service, orders, items };
}

describe('Product report calendar range', () => {
  const query = { from: '2026-10-19', to: '2026-10-19', branchId: 'branch' };
  function expectVietnamDay(args: any) {
    expect(args.from.toISOString()).toBe('2026-10-18T17:00:00.000Z');
    expect(args.to.toISOString()).toBe('2026-10-19T16:59:59.999Z');
    expect(args.branchId).toBe('branch');
  }
  it('uses the same local day for product plan, revenue, top and bottom products', async () => {
    const h = harness();
    await h.service.monthlyOrderPlan(query);
    await h.service.revenueSummary(query);
    await h.service.topProducts(query);
    await h.service.bottomProducts(query);
    expectVietnamDay(h.items.getMonthlyOrderPlanRows.mock.calls[0][0]);
    expectVietnamDay(h.orders.getRevenueSummaryRows.mock.calls[0][0]);
    expectVietnamDay(h.items.getTopProducts.mock.calls[0][0]);
    expectVietnamDay(h.items.getBottomProducts.mock.calls[0][0]);
  });
  it('preserves an hourly filter instead of resetting it to midnight', async () => {
    const h = harness();
    await h.service.monthlyOrderPlan({
      ...query,
      from: '2026-10-19T08:00:00+07:00',
      to: '2026-10-19T09:00:00+07:00',
    });
    const args = h.items.getMonthlyOrderPlanRows.mock.calls[0][0];
    expect(args.from.toISOString()).toBe('2026-10-19T01:00:00.000Z');
    expect(args.to.toISOString()).toBe('2026-10-19T02:00:00.000Z');
  });
});
