import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guard/roles.guard';
import { StockVoucherController } from './stock-voucher.controller';
import { StockTakeController } from '../stock-take/stock-take.controller';
import { StockTransferController } from '../stock-transfer/stock-transfer.controller';

describe('Kitchen warehouse document access', () => {
  const guard = new RolesGuard(new Reflector());
  const reads = [
    [StockVoucherController, 'findAll'],
    [StockTakeController, 'findAll'],
    [StockTakeController, 'findOne'],
    [StockTransferController, 'findAll'],
    [StockTransferController, 'findOne'],
  ] as const;
  for (const [controller, method] of reads) {
    const context = (userType: string) => ({
      getHandler: () => controller.prototype[method],
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ user: { userType } }) }),
    }) as any;
    it.each(['KITCHEN', 'CASHIER', 'STUDENT'])(`${controller.name}.${method} denies %s`, (role) => {
      expect(() => guard.canActivate(context(role))).toThrow(ForbiddenException);
    });
    it.each(['HEAD_CHEF', 'ADMIN', 'MANAGER'])(`${controller.name}.${method} permits %s`, (role) => {
      expect(guard.canActivate(context(role))).toBe(true);
    });
  }
  it('does not grant stock mutations to the head chef', () => {
    for (const [controller, method] of [
      [StockVoucherController, 'createMaterialImport'],
      [StockTakeController, 'createDraft'],
      [StockTransferController, 'create'],
    ] as const) {
      expect(() => guard.canActivate({
        getHandler: () => controller.prototype[method],
        getClass: () => controller,
        switchToHttp: () => ({ getRequest: () => ({ user: { userType: 'HEAD_CHEF' } }) }),
      } as any)).toThrow(ForbiddenException);
    }
  });
});
