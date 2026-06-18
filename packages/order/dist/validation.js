"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOrderDraft = validateOrderDraft;
exports.resolveNextPaymentStatus = resolveNextPaymentStatus;
const errors_js_1 = require("./errors.js");
const constants_js_1 = require("./constants.js");
const calculator_js_1 = require("./calculator.js");
function validateOrderDraft(order) {
    if (!order.items || order.items.length === 0) {
        throw new errors_js_1.OrderRuleError('Order must have at least one item');
    }
    const calculated = (0, calculator_js_1.calculateOrderTotals)(order.items);
    if ((0, calculator_js_1.normalizeNumber)(order.subtotal) !== calculated.subtotal) {
        throw new errors_js_1.OrderRuleError(`Invalid order subtotal: expected ${calculated.subtotal}, got ${order.subtotal}`);
    }
    if ((0, calculator_js_1.normalizeNumber)(order.discountAmount) !== calculated.discountAmount) {
        throw new errors_js_1.OrderRuleError(`Invalid order discountAmount: expected ${calculated.discountAmount}, got ${order.discountAmount}`);
    }
    if ((0, calculator_js_1.normalizeNumber)(order.totalAmount) !== calculated.totalAmount) {
        throw new errors_js_1.OrderRuleError(`Invalid order totalAmount: expected ${calculated.totalAmount}, got ${order.totalAmount}`);
    }
}
function resolveNextPaymentStatus(totalAmount, paidAmount) {
    const total = (0, calculator_js_1.normalizeNumber)(totalAmount);
    const paid = (0, calculator_js_1.normalizeNumber)(paidAmount);
    if (paid < 0) {
        throw new errors_js_1.OrderRuleError('Paid amount cannot be negative');
    }
    const changeAmount = (0, calculator_js_1.normalizeNumber)(paid - total);
    const isPaid = paid >= total;
    return {
        paymentStatus: isPaid
            ? constants_js_1.ORDER_PAYMENT_STATUS.PAID
            : paid > 0
                ? constants_js_1.ORDER_PAYMENT_STATUS.PARTIAL
                : constants_js_1.ORDER_PAYMENT_STATUS.UNPAID,
        status: isPaid ? constants_js_1.ORDER_STATUS.PREPARING : constants_js_1.ORDER_STATUS.DRAFT,
        changeAmount: isPaid ? changeAmount : 0,
    };
}
