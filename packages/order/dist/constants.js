"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_METHOD_VALUES = exports.PAYMENT_METHOD = exports.ORDER_PAYMENT_STATUS_VALUES = exports.ORDER_PAYMENT_STATUS = exports.REVENUE_ORDER_STATUSES = exports.ORDER_STATUS_NAME_TO_CODE = exports.ORDER_STATUS_VALUES = exports.ORDER_STATUS = void 0;
exports.resolveOrderStatus = resolveOrderStatus;
exports.ORDER_STATUS = {
    CANCELLED: 0,
    PREPARING: 1,
    PENDING: 2,
    PENDING_PAYMENT: 3,
    READY_TO_PICKUP: 4,
    DONE: 5,
    REFUNDED: 6,
    DRAFT: 7,
    WAITING: 8,
    READY: 9,
    RECEIVED: 10,
    COMPLETED: 11,
};
exports.ORDER_STATUS_VALUES = Object.values(exports.ORDER_STATUS);
exports.ORDER_STATUS_NAME_TO_CODE = {
    CANCELLED: exports.ORDER_STATUS.CANCELLED,
    PREPARING: exports.ORDER_STATUS.PREPARING,
    PENDING: exports.ORDER_STATUS.PENDING,
    PENDING_PAYMENT: exports.ORDER_STATUS.PENDING_PAYMENT,
    READY_TO_PICKUP: exports.ORDER_STATUS.READY_TO_PICKUP,
    DONE: exports.ORDER_STATUS.DONE,
    REFUNDED: exports.ORDER_STATUS.REFUNDED,
    DRAFT: exports.ORDER_STATUS.DRAFT,
    WAITING: exports.ORDER_STATUS.WAITING,
    READY: exports.ORDER_STATUS.READY,
    RECEIVED: exports.ORDER_STATUS.RECEIVED,
    COMPLETED: exports.ORDER_STATUS.COMPLETED,
};
function resolveOrderStatus(value) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const numericValue = Number(value);
    if (Number.isInteger(numericValue)) {
        return exports.ORDER_STATUS_VALUES.includes(numericValue)
            ? numericValue
            : undefined;
    }
    return exports.ORDER_STATUS_NAME_TO_CODE[String(value).toUpperCase()];
}
exports.REVENUE_ORDER_STATUSES = [
    exports.ORDER_STATUS.PENDING,
    exports.ORDER_STATUS.PENDING_PAYMENT,
    exports.ORDER_STATUS.PREPARING,
    exports.ORDER_STATUS.READY,
    exports.ORDER_STATUS.READY_TO_PICKUP,
    exports.ORDER_STATUS.RECEIVED,
    exports.ORDER_STATUS.DONE,
    exports.ORDER_STATUS.COMPLETED,
    exports.ORDER_STATUS.WAITING,
];
exports.ORDER_PAYMENT_STATUS = {
    UNPAID: 'UNPAID',
    PAID: 'PAID',
    PARTIAL: 'PARTIAL',
    REFUNDED: 'REFUNDED',
};
exports.ORDER_PAYMENT_STATUS_VALUES = Object.values(exports.ORDER_PAYMENT_STATUS);
exports.PAYMENT_METHOD = {
    CASH: 'CASH',
    WALLET: 'WALLET',
    CARD: 'CARD',
    BANK_TRANSFER: 'BANK_TRANSFER',
    QR: 'QR',
};
exports.PAYMENT_METHOD_VALUES = Object.values(exports.PAYMENT_METHOD);
