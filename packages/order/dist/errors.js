"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderRuleError = void 0;
class OrderRuleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OrderRuleError';
    }
}
exports.OrderRuleError = OrderRuleError;
