"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingRuleError = void 0;
class AccountingRuleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AccountingRuleError';
    }
}
exports.AccountingRuleError = AccountingRuleError;
