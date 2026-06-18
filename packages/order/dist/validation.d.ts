import { OrderDraft } from './types.js';
import { OrderStatus, OrderPaymentStatus } from './constants.js';
export declare function validateOrderDraft(order: OrderDraft): void;
export declare function resolveNextPaymentStatus(totalAmount: number, paidAmount: number): {
    paymentStatus: OrderPaymentStatus;
    status: OrderStatus;
    changeAmount: number;
};
