import { ConflictException, ForbiddenException } from '@nestjs/common';
import { KitchenService } from './kitchen.service';

function serviceWithFeature(enabled = true) {
  const service = Object.create(KitchenService.prototype);
  service.config = {
    get: (key: string) =>
      key === 'KITCHEN_MODULE_ENABLED' ? String(enabled) : undefined,
  };
  return service as KitchenService & Record<string, any>;
}

describe('KitchenService authorization and concurrency', () => {
  it('uses the JWT branch for kitchen staff', () => {
    const service = serviceWithFeature();
    expect(
      service.resolveBranch({
        userId: 'u1',
        userType: 'KITCHEN',
        branchId: 'b1',
      }),
    ).toBe('b1');
  });

  it('rejects a cross-branch kitchen request', () => {
    const service = serviceWithFeature();
    expect(() =>
      service.resolveBranch(
        { userId: 'u1', userType: 'KITCHEN', branchId: 'b1' },
        'b2',
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires an explicit branch for an unscoped admin', () => {
    const service = serviceWithFeature();
    expect(() =>
      service.resolveBranch({ userId: 'u1', userType: 'ADMIN' }),
    ).toThrow('branchId is required for ADMIN');
  });

  it('returns a conflict when optimistic ticket update loses the race', async () => {
    const service = serviceWithFeature();
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

  it('does not query tickets when the module is disabled', async () => {
    const service = serviceWithFeature(false);
    const exist = jest.fn();
    service.tickets = { exist };
    await expect(service.hasTicket('o1')).resolves.toBe(false);
    expect(exist).not.toHaveBeenCalled();
  });
});
