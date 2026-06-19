export declare const STOCK_VOUCHER_TYPE: {
    readonly IMPORT: "IMPORT";
    readonly EXPORT: "EXPORT";
};
export type StockVoucherType = (typeof STOCK_VOUCHER_TYPE)[keyof typeof STOCK_VOUCHER_TYPE];
export declare const STOCK_VOUCHER_TYPES: ("IMPORT" | "EXPORT")[];
