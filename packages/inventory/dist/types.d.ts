import { StockVoucherType } from './constants.js';
export interface StockVoucherItemDraft {
    inventoryItemId?: string | null;
    productId?: string | null;
    quantity: number;
    unitPrice?: number | null;
    totalAmount?: number | null;
    note?: string | null;
}
export interface StockVoucherDraft {
    branchId?: string | null;
    type: StockVoucherType | string;
    code?: string;
    supplierId?: string | null;
    orderId?: string | null;
    totalAmount?: number;
    fundId?: string | null;
    note?: string | null;
    items: StockVoucherItemDraft[];
}
export interface StockItem {
    id: string;
    quantity: number;
}
