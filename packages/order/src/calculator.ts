import { OrderItemDraft } from './types.js';
import { OrderRuleError } from './errors.js';

export function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new OrderRuleError('Value must be a valid finite number');
  }
  return Math.round(value * 100) / 100;
}

export function calculateOrderItemTotals(item: OrderItemDraft): {
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
} {
  const unitPrice = normalizeNumber(item.unitPrice);
  const quantity = normalizeNumber(item.quantity);
  const discountAmount = normalizeNumber(item.discountAmount ?? 0);

  if (quantity <= 0) {
    throw new OrderRuleError('Item quantity must be greater than 0');
  }
  if (unitPrice < 0) {
    throw new OrderRuleError('Item unit price cannot be negative');
  }
  if (discountAmount < 0) {
    throw new OrderRuleError('Item discount amount cannot be negative');
  }

  const subtotal = normalizeNumber(unitPrice * quantity);
  const totalAmount = normalizeNumber(subtotal - discountAmount);

  if (totalAmount < 0) {
    throw new OrderRuleError('Item total amount cannot be negative');
  }

  return { subtotal, discountAmount, totalAmount };
}

export function calculateOrderTotals(items: OrderItemDraft[]): {
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let discountAmount = 0;

  for (const item of items) {
    const totals = calculateOrderItemTotals(item);
    subtotal += totals.subtotal;
    discountAmount += totals.discountAmount;
  }

  const totalAmount = normalizeNumber(subtotal - discountAmount);
  if (totalAmount < 0) {
    throw new OrderRuleError('Order total amount cannot be negative');
  }

  return {
    subtotal: normalizeNumber(subtotal),
    discountAmount: normalizeNumber(discountAmount),
    totalAmount,
  };
}
