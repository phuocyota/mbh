import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guard/roles.guard';
import { StockVoucherController } from './stock-voucher.controller';

describe('Stock voucher role boundaries', () => {
  const guard = new RolesGuard(new Reflector());
  const controller = new StockVoucherController({} as any);
  const methods = [
    'createImport',
    'createExport',
    'createMaterialImport',
    'createSale',
    'create',
  ] as const;
  function context(method: (typeof methods)[number], userType: string) {
    return {
      getHandler: () => controller[method],
      getClass: () => StockVoucherController,
      switchToHttp: () => ({ getRequest: () => ({ user: { userType } }) }),
    } as any;
  }
  it.each(methods)('denies kitchen staff on %s', (method) => {
    expect(() => guard.canActivate(context(method, 'KITCHEN'))).toThrow(
      ForbiddenException,
    );
  });
  it.each(methods)('preserves admin access to %s', (method) => {
    expect(guard.canActivate(context(method, 'ADMIN'))).toBe(true);
  });
});
