export declare const MONEY_VOUCHER_TYPE: {
    readonly RECEIPT: "RECEIPT";
    readonly PAYMENT: "PAYMENT";
};
export type MoneyVoucherType = (typeof MONEY_VOUCHER_TYPE)[keyof typeof MONEY_VOUCHER_TYPE];
export declare const MONEY_VOUCHER_TYPES: ("RECEIPT" | "PAYMENT")[];
export declare const ACCOUNTING_PURPOSE: {
    readonly ORDER_PAYMENT: "ORDER_PAYMENT";
    readonly STOCK_EXPORT: "STOCK_EXPORT";
    readonly STOCK_IMPORT: "STOCK_IMPORT";
    readonly SUPPLIER_DEBT_OFFSET: "SUPPLIER_DEBT_OFFSET";
};
export type AccountingPurpose = (typeof ACCOUNTING_PURPOSE)[keyof typeof ACCOUNTING_PURPOSE];
export declare const ACCOUNTING_SOURCE_TYPE: {
    readonly ORDER: "ORDER";
    readonly PAYMENT: "PAYMENT";
    readonly REFUND: "REFUND";
    readonly CASH_MOVEMENT: "CASH_MOVEMENT";
    readonly WALLET_TRANSACTION: "WALLET_TRANSACTION";
    readonly MONEY_VOUCHER: "MONEY_VOUCHER";
    readonly STOCK_VOUCHER: "STOCK_VOUCHER";
    readonly STOCK_RECEIPT_DETAIL: "STOCK_RECEIPT_DETAIL";
    readonly PAYROLL: "PAYROLL";
};
export type AccountingSourceType = (typeof ACCOUNTING_SOURCE_TYPE)[keyof typeof ACCOUNTING_SOURCE_TYPE];
export declare const DEBT_TRANSACTION_TYPE: {
    readonly PAYMENT_OFFSET: "PAYMENT_OFFSET";
};
export type DebtTransactionType = (typeof DEBT_TRANSACTION_TYPE)[keyof typeof DEBT_TRANSACTION_TYPE];
export declare const MONEY_VOUCHER_CODE_PREFIX: Record<MoneyVoucherType, string>;
export declare const JOURNAL_ENTRY_STATUS: {
    readonly DRAFT: "DRAFT";
    readonly POSTED: "POSTED";
    readonly CANCELLED: "CANCELLED";
    readonly REVERSED: "REVERSED";
};
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUS)[keyof typeof JOURNAL_ENTRY_STATUS];
export declare const PURPOSE_ACCOUNT_MAP: Record<AccountingPurpose, {
    receiptAccountCode?: string;
    paymentAccountCode?: string;
}>;
