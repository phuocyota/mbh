export const WAREHOUSE_VOUCHER_TYPE = {
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
} as const;

export type WarehouseVoucherType =
  (typeof WAREHOUSE_VOUCHER_TYPE)[keyof typeof WAREHOUSE_VOUCHER_TYPE];

export const WAREHOUSE_VOUCHER_TYPES = Object.values(WAREHOUSE_VOUCHER_TYPE);
