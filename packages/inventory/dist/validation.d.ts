import { WarehouseVoucherDraft } from './types.js';
import { WarehouseVoucherType } from './constants.js';
export declare function validateWarehouseVoucherDraft(voucher: WarehouseVoucherDraft): void;
export declare function calculateNextStockLevel(currentQuantity: number, quantityChange: number, type: WarehouseVoucherType | string): number;
export declare function calculateNextStock(item: {
    id: string;
    quantity: number;
}, quantityChange: number, type: WarehouseVoucherType | string): number;
