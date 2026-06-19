export const MONEY_VOUCHER_TYPE = {
  RECEIPT: 'RECEIPT',
  PAYMENT: 'PAYMENT',
} as const;

export type MoneyVoucherType =
  (typeof MONEY_VOUCHER_TYPE)[keyof typeof MONEY_VOUCHER_TYPE];

export const MONEY_VOUCHER_TYPES = Object.values(MONEY_VOUCHER_TYPE);

export const ACCOUNTING_PURPOSE = {
  ORDER_PAYMENT: 'ORDER_PAYMENT',
  WAREHOUSE_EXPORT: 'WAREHOUSE_EXPORT',
  WAREHOUSE_IMPORT: 'WAREHOUSE_IMPORT',
  SUPPLIER_DEBT_OFFSET: 'SUPPLIER_DEBT_OFFSET',
} as const;

export type AccountingPurpose =
  (typeof ACCOUNTING_PURPOSE)[keyof typeof ACCOUNTING_PURPOSE];

export const ACCOUNTING_SOURCE_TYPE = {
  ORDER: 'ORDER',
  PAYMENT: 'PAYMENT',
  REFUND: 'REFUND',
  CASH_MOVEMENT: 'CASH_MOVEMENT',
  WALLET_TRANSACTION: 'WALLET_TRANSACTION',
  MONEY_VOUCHER: 'MONEY_VOUCHER',
  WAREHOUSE_VOUCHER: 'WAREHOUSE_VOUCHER',
  STOCK_RECEIPT_DETAIL: 'STOCK_RECEIPT_DETAIL',
  PAYROLL: 'PAYROLL',
} as const;

export type AccountingSourceType =
  (typeof ACCOUNTING_SOURCE_TYPE)[keyof typeof ACCOUNTING_SOURCE_TYPE];

export const DEBT_TRANSACTION_TYPE = {
  PAYMENT_OFFSET: 'PAYMENT_OFFSET',
} as const;

export type DebtTransactionType =
  (typeof DEBT_TRANSACTION_TYPE)[keyof typeof DEBT_TRANSACTION_TYPE];

export const MONEY_VOUCHER_CODE_PREFIX: Record<MoneyVoucherType, string> = {
  [MONEY_VOUCHER_TYPE.RECEIPT]: 'PT',
  [MONEY_VOUCHER_TYPE.PAYMENT]: 'PC',
};

export const JOURNAL_ENTRY_STATUS = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
} as const;

export type JournalEntryStatus =
  (typeof JOURNAL_ENTRY_STATUS)[keyof typeof JOURNAL_ENTRY_STATUS];

export const PURPOSE_ACCOUNT_MAP: Record<
  AccountingPurpose,
  { receiptAccountCode?: string; paymentAccountCode?: string }
> = {
  [ACCOUNTING_PURPOSE.ORDER_PAYMENT]: { receiptAccountCode: '5111' },
  [ACCOUNTING_PURPOSE.WAREHOUSE_EXPORT]: { receiptAccountCode: '5111' },
  [ACCOUNTING_PURPOSE.WAREHOUSE_IMPORT]: { paymentAccountCode: '1561' },
  [ACCOUNTING_PURPOSE.SUPPLIER_DEBT_OFFSET]: { paymentAccountCode: '331' },
};
