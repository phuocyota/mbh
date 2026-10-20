import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guard/roles.guard';
import { KitchenController } from './kitchen.controller';
import { KitchenOperationsController } from './kitchen-operations.controller';

describe('Kitchen controller cashier permissions', () => {
  const guard = new RolesGuard(new Reflector());
  const context = (controller: any, handler: any, role: string) =>
    ({
      getClass: () => controller,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ user: { userType: role } }),
      }),
    }) as any;

  for (const controller of [KitchenController, KitchenOperationsController]) {
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      if (name === 'constructor') continue;
      const handler = controller.prototype[name];
      it(`${controller.name}.${name} preserves shared access except kitchen-only task workflow`, () => {
        let kitchenAllowed = true;
        try {
          guard.canActivate(context(controller, handler, 'KITCHEN'));
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          kitchenAllowed = false;
        }
        const kitchenOnlyTask =
          controller === KitchenController &&
          ['taskList', 'taskDetail', 'taskAction'].includes(name);
        if (kitchenAllowed && !kitchenOnlyTask) {
          expect(
            guard.canActivate(context(controller, handler, 'CASHIER')),
          ).toBe(true);
          expect(() =>
            guard.canActivate(context(controller, handler, 'STUDENT')),
          ).toThrow(ForbiddenException);
        } else {
          expect(() =>
            guard.canActivate(context(controller, handler, 'CASHIER')),
          ).toThrow(ForbiddenException);
        }
      });
    }
  }
});
