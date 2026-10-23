import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guard/roles.guard';
import { KitchenController } from './kitchen.controller';
import { KitchenOperationsController } from './kitchen-operations.controller';
import { KitchenService } from './kitchen.service';

describe('Kitchen reports for head chefs', () => {
  const guard = new RolesGuard(new Reflector());
  const actor = { userId: 'chef', userType: 'HEAD_CHEF', branchId: 'branch-a' };
  it.each([
    [KitchenController, 'report'],
    [KitchenController, 'materialInventoryReport'],
    [KitchenOperationsController, 'report'],
  ])(
    'permits HEAD_CHEF but not kitchen staff or cashiers on %p.%s',
    (controller, name) => {
      const context = (role: string) =>
        ({
          getClass: () => controller,
          getHandler: () => controller.prototype[name],
          switchToHttp: () => ({
            getRequest: () => ({ user: { userType: role } }),
          }),
        }) as any;
      expect(guard.canActivate(context('HEAD_CHEF'))).toBe(true);
      expect(() => guard.canActivate(context('KITCHEN'))).toThrow();
      expect(() => guard.canActivate(context('CASHIER'))).toThrow();
    },
  );
  function service() {
    const instance = Object.create(KitchenService.prototype) as KitchenService;
    const query = jest.fn().mockResolvedValue([]);
    Object.assign(instance, { dataSource: { query } });
    return { instance, query };
  }
  it('binds the authenticated branch and selected dates without filtering material balances by shift', async () => {
    const h = service();
    const result = await h.instance.materialInventoryReport(actor, {
      from: '2026-10-01',
      to: '2026-10-02',
      shift: 'Ca sáng',
    });
    expect(h.query).toHaveBeenCalledWith(expect.any(String), [
      'branch-a',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(result).toEqual({ from: '2026-10-01', to: '2026-10-02', data: [] });
  });
  it('rejects cross-branch reads before querying data', async () => {
    const h = service();
    await expect(
      h.instance.materialInventoryReport(actor, { branchId: 'branch-b' }),
    ).rejects.toThrow();
    expect(h.query).not.toHaveBeenCalled();
  });
  it.each([
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '2026-10-02', to: '2026-10-01' },
    { from: '2020-01-01', to: '2026-10-01' },
  ])('rejects invalid report ranges before querying: %j', async (range) => {
    const h = service();
    await expect(
      h.instance.materialInventoryReport(actor, range),
    ).rejects.toThrow();
    expect(h.query).not.toHaveBeenCalled();
  });
});
