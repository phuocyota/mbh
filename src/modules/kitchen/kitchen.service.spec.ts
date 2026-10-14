import { ConflictException, ForbiddenException } from '@nestjs/common';
import { KitchenService } from './kitchen.service';

function createService() {
  const service = Object.create(KitchenService.prototype);
  service.config = {
    get: jest.fn().mockReturnValue(undefined),
  };
  return service as KitchenService & Record<string, any>;
}

describe('KitchenService authorization and concurrency', () => {
  it('lists active units without requiring a module feature flag', async () => {
    const service = createService();
    const units = [{ id: 'unit-1', code: 'kg', isActive: true }];
    service.units = { find: jest.fn().mockResolvedValue(units) };
    await expect(service.listUnits()).resolves.toEqual(units);
    expect(service.units.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { dimension: 'ASC', factorToBase: 'ASC' },
    });
    expect(service.config.get).not.toHaveBeenCalled();
  });

  it.each(['KITCHEN', 'CASHIER'])('uses the JWT branch for %s', (userType) => {
    const service = createService();
    expect(
      service.resolveBranch({
        userId: 'u1',
        userType,
        branchId: 'b1',
      }),
    ).toBe('b1');
  });

  it.each(['KITCHEN', 'CASHIER'])(
    'rejects a cross-branch %s request',
    (userType) => {
      const service = createService();
      expect(() =>
        service.resolveBranch({ userId: 'u1', userType, branchId: 'b1' }, 'b2'),
      ).toThrow(ForbiddenException);
    },
  );

  it('requires an explicit branch for an unscoped admin', () => {
    const service = createService();
    expect(() =>
      service.resolveBranch({ userId: 'u1', userType: 'ADMIN' }),
    ).toThrow('branchId is required for ADMIN');
  });

  it('returns a conflict when optimistic ticket update loses the race', async () => {
    const service = createService();
    service.getTicket = jest.fn().mockResolvedValue({
      id: 't1',
      orderId: 'o1',
      branchId: 'b1',
      status: 'WAITING',
    });
    service.tickets = {
      createQueryBuilder: () => ({
        update() {
          return this;
        },
        set() {
          return this;
        },
        where() {
          return this;
        },
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }),
    };
    await expect(
      service.transitionTicket(
        { userId: 'u1', userType: 'KITCHEN', branchId: 'b1' },
        't1',
        1,
        'PREPARING',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('queries tickets without a module feature flag', async () => {
    const service = createService();
    const exist = jest.fn().mockResolvedValue(true);
    service.tickets = { exist };
    await expect(service.hasTicket('o1')).resolves.toBe(true);
    expect(exist).toHaveBeenCalledWith({ where: { orderId: 'o1' } });
  });
});
