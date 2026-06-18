"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWarehouseVoucherDraft = validateWarehouseVoucherDraft;
exports.calculateNextStockLevel = calculateNextStockLevel;
exports.calculateNextStock = calculateNextStock;
const errors_js_1 = require("./errors.js");
const constants_js_1 = require("./constants.js");
function validateWarehouseVoucherDraft(voucher) {
    const type = String(voucher.type || '').toUpperCase();
    if (!constants_js_1.WAREHOUSE_VOUCHER_TYPES.includes(type)) {
        throw new errors_js_1.InventoryRuleError(`Warehouse voucher type must be IMPORT or EXPORT, got '${voucher.type}'`);
    }
    if (!voucher.items || voucher.items.length === 0) {
        throw new errors_js_1.InventoryRuleError('Warehouse voucher must contain at least one item');
    }
    for (const item of voucher.items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
            throw new errors_js_1.InventoryRuleError('Warehouse voucher item quantity must be greater than 0');
        }
        if (item.unitPrice !== undefined && item.unitPrice !== null) {
            if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
                throw new errors_js_1.InventoryRuleError('Warehouse voucher item unit price cannot be negative');
            }
        }
    }
}
function calculateNextStockLevel(currentQuantity, quantityChange, type) {
    const normalizedType = String(type || '').toUpperCase();
    const current = Number(currentQuantity || 0);
    const change = Number(quantityChange || 0);
    if (!Number.isFinite(current) || !Number.isFinite(change)) {
        throw new errors_js_1.InventoryRuleError('Stock quantities must be valid numbers');
    }
    if (change < 0) {
        throw new errors_js_1.InventoryRuleError('Quantity change amount cannot be negative');
    }
    if (normalizedType === constants_js_1.WAREHOUSE_VOUCHER_TYPE.IMPORT) {
        return current + change;
    }
    else if (normalizedType === constants_js_1.WAREHOUSE_VOUCHER_TYPE.EXPORT) {
        const nextQuantity = current - change;
        if (nextQuantity < 0) {
            throw new errors_js_1.InventoryRuleError('Stock quantity is not enough');
        }
        return nextQuantity;
    }
    else {
        throw new errors_js_1.InventoryRuleError(`Invalid voucher type for stock calculation: ${type}`);
    }
}
function calculateNextStock(item, quantityChange, type) {
    try {
        return calculateNextStockLevel(item.quantity, quantityChange, type);
    }
    catch (error) {
        if (error instanceof errors_js_1.InventoryRuleError && error.message === 'Stock quantity is not enough') {
            throw new errors_js_1.InventoryRuleError(`Stock quantity is not enough for item: ${item.id}`);
        }
        throw error;
    }
}
