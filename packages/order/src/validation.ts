import { OrderDraft } from './types.js';
import { OrderRuleError } from './errors.js';
import { ORDER_STATUS, ORDER_PAYMENT_STATUS, OrderStatus, OrderPaymentStatus } from './constants.js';
import { calculateOrderTotals, normalizeNumber } from './calculator.js';

export function validateOrderDraft(order: OrderDraft) {
  if (!order.items || order.items.length === 0) {
    throw new OrderRuleError('Order must have at least one item');
  }

  const calculated = calculateOrderTotals(order.items);
  if (normalizeNumber(order.subtotal) !== calculated.subtotal) {
    throw new OrderRuleError(
      `Invalid order subtotal: expected ${calculated.subtotal}, got ${order.subtotal}`
    );
  }
  if (normalizeNumber(order.discountAmount) !== calculated.discountAmount) {
    throw new OrderRuleError(
      `Invalid order discountAmount: expected ${calculated.discountAmount}, got ${order.discountAmount}`
    );
  }
  if (normalizeNumber(order.totalAmount) !== calculated.totalAmount) {
    throw new OrderRuleError(
      `Invalid order totalAmount: expected ${calculated.totalAmount}, got ${order.totalAmount}`
    );
  }
}

export function resolveNextPaymentStatus(
  totalAmount: number,
  paidAmount: number
): {
  paymentStatus: OrderPaymentStatus;
  status: OrderStatus;
  changeAmount: number;
} {
  const total = normalizeNumber(totalAmount);
  const paid = normalizeNumber(paidAmount);

  if (paid < 0) {
    throw new OrderRuleError('Paid amount cannot be negative');
  }

  const changeAmount = normalizeNumber(paid - total);
  const isPaid = paid >= total;

  return {
    paymentStatus: isPaid
      ? ORDER_PAYMENT_STATUS.PAID
      : paid > 0
      ? ORDER_PAYMENT_STATUS.PARTIAL
      : ORDER_PAYMENT_STATUS.UNPAID,
    status: isPaid ? ORDER_STATUS.PREPARING : ORDER_STATUS.DRAFT,
    changeAmount: isPaid ? changeAmount : 0,
  };
}
