import { OrderItemDraft } from './types.js';
export declare function normalizeNumber(value: number): number;
export declare function calculateOrderItemTotals(item: OrderItemDraft): {
    subtotal: number;
    discountAmount: number;
    totalAmount: number;
};
export declare function calculateOrderTotals(items: OrderItemDraft[]): {
    subtotal: number;
    discountAmount: number;
    totalAmount: number;
};
