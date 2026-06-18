"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryRuleError = void 0;
class InventoryRuleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InventoryRuleError';
    }
}
exports.InventoryRuleError = InventoryRuleError;
