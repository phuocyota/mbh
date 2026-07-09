export const STOCK_VOUCHER_TYPE = {
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  TRANSFER: 'TRANSFER',
} as const;

export const STOCK_PARTY_TYPE = {
  SUPPLIER: 'SUPPLIER',
  CUSTOMER: 'CUSTOMER',
  BRANCH: 'BRANCH',
  STOCK: 'STOCK',
} as const;

export const STOCK_VOUCHER_STATUS = {
  COMPLETED: 'COMPLETED',
} as const;

export const STOCK_PAYMENT_STATUS = {
  PAID: 'PAID',
  UNPAID: 'UNPAID',
  DEBT: 'DEBT',
} as const;

export type StockVoucherType =
  (typeof STOCK_VOUCHER_TYPE)[keyof typeof STOCK_VOUCHER_TYPE];
