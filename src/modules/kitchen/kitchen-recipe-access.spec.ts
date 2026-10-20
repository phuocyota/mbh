import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guard/roles.guard';
import { KitchenController } from './kitchen.controller';
import { KitchenOperationsService } from './kitchen-operations.service';

describe('Kitchen recipe and menu setup permissions', () => {
  const guard = new RolesGuard(new Reflector());
  const controller = new KitchenController({} as any, {} as any, {} as any);
  const operations = Object.create(
    KitchenOperationsService.prototype,
  ) as KitchenOperationsService;
  function context(
    method:
      | 'createRecipe'
      | 'activateRecipe'
      | 'submitRecipe'
      | 'approveRecipe'
      | 'requestRecipeChanges'
      | 'createStation'
      | 'taskList'
      | 'taskDetail'
      | 'taskAction',
    userType: string,
  ) {
    return {
      getHandler: () => controller[method],
      getClass: () => KitchenController,
      switchToHttp: () => ({ getRequest: () => ({ user: { userType } }) }),
    } as any;
  }
  it.each(['taskList', 'taskDetail', 'taskAction'] as const)(
    'limits %s to kitchen operators and managers',
    (method) => {
      for (const role of ['KITCHEN', 'HEAD_CHEF', 'ADMIN', 'MANAGER'])
        expect(guard.canActivate(context(method, role))).toBe(true);
      for (const role of ['CASHIER', 'CUSTOMER'])
        expect(() => guard.canActivate(context(method, role))).toThrow(
          ForbiddenException,
        );
    },
  );
  it.each(['createRecipe', 'submitRecipe'] as const)(
    'allows head chefs to %s',
    (method) => {
      expect(guard.canActivate(context(method, 'HEAD_CHEF'))).toBe(true);
      expect(() => guard.canActivate(context(method, 'KITCHEN'))).toThrow(
        ForbiddenException,
      );
      expect(() => guard.canActivate(context(method, 'CASHIER'))).toThrow(
        ForbiddenException,
      );
    },
  );
  it.each(['activateRecipe', 'approveRecipe', 'requestRecipeChanges'] as const)(
    'allows only admin to %s',
    (method) => {
      expect(guard.canActivate(context(method, 'ADMIN'))).toBe(true);
      for (const role of ['HEAD_CHEF', 'KITCHEN', 'MANAGER', 'CASHIER'])
        expect(() => guard.canActivate(context(method, role))).toThrow(
          ForbiddenException,
        );
    },
  );
  it('does not grant kitchen staff general configuration or manual plan approval rights', () => {
    expect(() =>
      guard.canActivate(context('createStation', 'KITCHEN')),
    ).toThrow(ForbiddenException);
    expect(() => operations.manager({ userType: 'KITCHEN' })).toThrow(
      ForbiddenException,
    );
  });
  it('head chefs inherit kitchen operations but not management permissions', () => {
    const request = (handler: any) =>
      ({
        getHandler: () => handler,
        getClass: () => KitchenController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { userType: 'HEAD_CHEF' } }),
        }),
      }) as any;
    expect(guard.canActivate(request(controller.units))).toBe(true);
    expect(guard.canActivate(request(controller.startBatch))).toBe(true);
    expect(() =>
      guard.canActivate(context('createStation', 'HEAD_CHEF')),
    ).toThrow(ForbiddenException);
    expect(() => operations.manager({ userType: 'HEAD_CHEF' })).toThrow(
      ForbiddenException,
    );
    expect(() =>
      operations.branch({ userType: 'HEAD_CHEF', branchId: 'a' }, 'b'),
    ).toThrow(ForbiddenException);
  });
  it('allows only kitchen, admin and manager to edit menus', () => {
    for (const userType of ['KITCHEN', 'HEAD_CHEF', 'ADMIN', 'MANAGER'])
      expect(() => operations.menuEditor({ userType })).not.toThrow();
    expect(() => operations.menuEditor({ userType: 'CASHIER' })).toThrow(
      ForbiddenException,
    );
    expect(() =>
      operations.branch({ userType: 'KITCHEN', branchId: 'a' }, 'b'),
    ).toThrow(ForbiddenException);
  });
});
