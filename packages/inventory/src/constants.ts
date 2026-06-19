export const STOCK_VOUCHER_TYPE = {
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
} as const;

export type StockVoucherType =
  (typeof STOCK_VOUCHER_TYPE)[keyof typeof STOCK_VOUCHER_TYPE];

export const STOCK_VOUCHER_TYPES = Object.values(STOCK_VOUCHER_TYPE);
