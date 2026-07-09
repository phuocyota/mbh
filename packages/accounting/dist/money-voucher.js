"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMoneyVoucherType = normalizeMoneyVoucherType;
exports.createMoneyVoucherCode = createMoneyVoucherCode;
exports.getFundBalanceAfterVoucher = getFundBalanceAfterVoucher;
exports.defaultAccountingSourceType = defaultAccountingSourceType;
const constants_js_1 = require("./constants.js");
const errors_js_1 = require("./errors.js");
function normalizeMoneyVoucherType(type) {
    const normalized = String(type || '').toUpperCase();
    if (!constants_js_1.MONEY_VOUCHER_TYPES.includes(normalized)) {
        throw new errors_js_1.AccountingRuleError('Money voucher type must be RECEIPT or PAYMENT');
    }
    return normalized;
}
function createMoneyVoucherCode(type, now = Date.now()) {
    return `${constants_js_1.MONEY_VOUCHER_CODE_PREFIX[type]}${now}`;
}
function getFundBalanceAfterVoucher(params) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
        throw new errors_js_1.AccountingRuleError('Money voucher amount must be greater than 0');
    }
    const nextBalance = params.type === constants_js_1.MONEY_VOUCHER_TYPE.RECEIPT
        ? params.currentBalance + params.amount
        : params.currentBalance - params.amount;
    if (nextBalance < 0) {
        throw new errors_js_1.AccountingRuleError('Fund balance is not enough');
    }
    return nextBalance;
}
function defaultAccountingSourceType(refType) {
    return refType || constants_js_1.ACCOUNTING_SOURCE_TYPE.MONEY_VOUCHER;
}
