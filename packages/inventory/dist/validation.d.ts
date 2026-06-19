import { StockVoucherDraft } from './types.js';
import { StockVoucherType } from './constants.js';
export declare function validateStockVoucherDraft(voucher: StockVoucherDraft): void;
export declare function calculateNextStockLevel(currentQuantity: number, quantityChange: number, type: StockVoucherType | string): number;
export declare function calculateNextStock(item: {
    id: string;
    quantity: number;
}, quantityChange: number, type: StockVoucherType | string): number;
