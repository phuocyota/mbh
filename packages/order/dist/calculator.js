"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeNumber = normalizeNumber;
exports.calculateOrderItemTotals = calculateOrderItemTotals;
exports.calculateOrderTotals = calculateOrderTotals;
const errors_js_1 = require("./errors.js");
function normalizeNumber(value) {
    if (!Number.isFinite(value)) {
        throw new errors_js_1.OrderRuleError('Value must be a valid finite number');
    }
    return Math.round(value * 100) / 100;
}
function calculateOrderItemTotals(item) {
    const unitPrice = normalizeNumber(item.unitPrice);
    const quantity = normalizeNumber(item.quantity);
    const discountAmount = normalizeNumber(item.discountAmount ?? 0);
    if (quantity <= 0) {
        throw new errors_js_1.OrderRuleError('Item quantity must be greater than 0');
    }
    if (unitPrice < 0) {
        throw new errors_js_1.OrderRuleError('Item unit price cannot be negative');
    }
    if (discountAmount < 0) {
        throw new errors_js_1.OrderRuleError('Item discount amount cannot be negative');
    }
    const subtotal = normalizeNumber(unitPrice * quantity);
    const totalAmount = normalizeNumber(subtotal - discountAmount);
    if (totalAmount < 0) {
        throw new errors_js_1.OrderRuleError('Item total amount cannot be negative');
    }
    return { subtotal, discountAmount, totalAmount };
}
function calculateOrderTotals(items) {
    let subtotal = 0;
    let discountAmount = 0;
    for (const item of items) {
        const totals = calculateOrderItemTotals(item);
        subtotal += totals.subtotal;
        discountAmount += totals.discountAmount;
    }
    const totalAmount = normalizeNumber(subtotal - discountAmount);
    if (totalAmount < 0) {
        throw new errors_js_1.OrderRuleError('Order total amount cannot be negative');
    }
    return {
        subtotal: normalizeNumber(subtotal),
        discountAmount: normalizeNumber(discountAmount),
        totalAmount,
    };
}
