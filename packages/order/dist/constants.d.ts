export declare const ORDER_STATUS: {
    readonly CANCELLED: 0;
    readonly PREPARING: 1;
    readonly PENDING: 2;
    readonly PENDING_PAYMENT: 3;
    readonly READY_TO_PICKUP: 4;
    readonly DONE: 5;
    readonly REFUNDED: 6;
    readonly DRAFT: 7;
    readonly WAITING: 8;
    readonly READY: 9;
    readonly RECEIVED: 10;
    readonly COMPLETED: 11;
};
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export declare const ORDER_STATUS_VALUES: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11)[];
export declare const ORDER_STATUS_NAME_TO_CODE: {
    readonly CANCELLED: 0;
    readonly PREPARING: 1;
    readonly PENDING: 2;
    readonly PENDING_PAYMENT: 3;
    readonly READY_TO_PICKUP: 4;
    readonly DONE: 5;
    readonly REFUNDED: 6;
    readonly DRAFT: 7;
    readonly WAITING: 8;
    readonly READY: 9;
    readonly RECEIVED: 10;
    readonly COMPLETED: 11;
};
export declare function resolveOrderStatus(value?: string | number | null): OrderStatus | undefined;
export declare const REVENUE_ORDER_STATUSES: readonly [2, 3, 1, 9, 4, 10, 5, 11, 8];
export declare const ORDER_PAYMENT_STATUS: {
    readonly UNPAID: "UNPAID";
    readonly PAID: "PAID";
    readonly PARTIAL: "PARTIAL";
    readonly REFUNDED: "REFUNDED";
};
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUS)[keyof typeof ORDER_PAYMENT_STATUS];
export declare const ORDER_PAYMENT_STATUS_VALUES: ("REFUNDED" | "UNPAID" | "PAID" | "PARTIAL")[];
export declare const PAYMENT_METHOD: {
    readonly CASH: "CASH";
    readonly WALLET: "WALLET";
    readonly CARD: "CARD";
    readonly BANK_TRANSFER: "BANK_TRANSFER";
    readonly QR: "QR";
};
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
export declare const PAYMENT_METHOD_VALUES: ("CASH" | "WALLET" | "CARD" | "BANK_TRANSFER" | "QR")[];
