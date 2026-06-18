import { WarehouseVoucherDraft, WarehouseVoucherItemDraft } from './types.js';
import { InventoryRuleError } from './errors.js';
import { WAREHOUSE_VOUCHER_TYPE, WAREHOUSE_VOUCHER_TYPES, WarehouseVoucherType } from './constants.js';

export function validateWarehouseVoucherDraft(voucher: WarehouseVoucherDraft) {
  const type = String(voucher.type || '').toUpperCase();
  if (!WAREHOUSE_VOUCHER_TYPES.includes(type as WarehouseVoucherType)) {
    throw new InventoryRuleError(
      `Warehouse voucher type must be IMPORT or EXPORT, got '${voucher.type}'`
    );
  }

  if (!voucher.items || voucher.items.length === 0) {
    throw new InventoryRuleError('Warehouse voucher must contain at least one item');
  }

  for (const item of voucher.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new InventoryRuleError('Warehouse voucher item quantity must be greater than 0');
    }
    if (item.unitPrice !== undefined && item.unitPrice !== null) {
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        throw new InventoryRuleError('Warehouse voucher item unit price cannot be negative');
      }
    }
  }
}

export function calculateNextStockLevel(
  currentQuantity: number,
  quantityChange: number,
  type: WarehouseVoucherType | string
): number {
  const normalizedType = String(type || '').toUpperCase();
  const current = Number(currentQuantity || 0);
  const change = Number(quantityChange || 0);

  if (!Number.isFinite(current) || !Number.isFinite(change)) {
    throw new InventoryRuleError('Stock quantities must be valid numbers');
  }
  if (change < 0) {
    throw new InventoryRuleError('Quantity change amount cannot be negative');
  }

  if (normalizedType === WAREHOUSE_VOUCHER_TYPE.IMPORT) {
    return current + change;
  } else if (normalizedType === WAREHOUSE_VOUCHER_TYPE.EXPORT) {
    const nextQuantity = current - change;
    if (nextQuantity < 0) {
      throw new InventoryRuleError('Stock quantity is not enough');
    }
    return nextQuantity;
  } else {
    throw new InventoryRuleError(`Invalid voucher type for stock calculation: ${type}`);
  }
}

export function calculateNextStock(
  item: { id: string; quantity: number },
  quantityChange: number,
  type: WarehouseVoucherType | string
): number {
  try {
    return calculateNextStockLevel(item.quantity, quantityChange, type);
  } catch (error) {
    if (error instanceof InventoryRuleError && error.message === 'Stock quantity is not enough') {
      throw new InventoryRuleError(`Stock quantity is not enough for item: ${item.id}`);
    }
    throw error;
  }
}
