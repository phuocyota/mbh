import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** Warehouse receipts retain the original product ID across branch transfers. */
export function stockProductCondition(alias: 'p' | 'product') {
  return `(${alias}.branch_id=:branchId OR EXISTS(SELECT 1 FROM stock_items scope_item JOIN stocks scope_stock ON scope_stock.id=scope_item.stock_id WHERE scope_item.product_id=${alias}.id AND scope_stock.branch_id=:branchId))`;
}
export async function canUseStockProduct(
  manager: EntityManager,
  product: { id: string; branchId: string | null },
  branchId: string,
) {
  if (!product.branchId || product.branchId === branchId) return true;
  const [row] = await manager.query(
    'SELECT EXISTS(SELECT 1 FROM stock_items si JOIN stocks s ON s.id=si.stock_id WHERE si.product_id=$1 AND s.branch_id=$2) AS allowed',
    [product.id, branchId],
  );
  return row?.allowed === true;
}
export function resolveStockBranch(actor: any, requested?: string) {
  if (actor?.userType === 'ADMIN') {
    if (!requested && !actor.branchId)
      throw new BadRequestException('BRANCH_REQUIRED');
    return requested || actor.branchId;
  }
  if (!actor?.branchId || (requested && requested !== actor.branchId))
    throw new ForbiddenException('CROSS_BRANCH_FORBIDDEN');
  return actor.branchId;
}
