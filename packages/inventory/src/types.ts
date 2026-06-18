import { WarehouseVoucherType } from './constants.js';

export interface WarehouseVoucherItemDraft {
  inventoryItemId?: string | null;
  productId?: string | null;
  quantity: number;
  unitPrice?: number | null;
  totalAmount?: number | null;
  note?: string | null;
}

export interface WarehouseVoucherDraft {
  branchId?: string | null;
  type: WarehouseVoucherType | string;
  code?: string;
  supplierId?: string | null;
  orderId?: string | null;
  totalAmount?: number;
  fundId?: string | null;
  note?: string | null;
  items: WarehouseVoucherItemDraft[];
}

export interface StockItem {
  id: string;         // Can be Product ID, InventoryItem ID, or SKU
  quantity: number;   // Current quantity in stock
}
