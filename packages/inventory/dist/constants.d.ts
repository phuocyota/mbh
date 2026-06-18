export declare const WAREHOUSE_VOUCHER_TYPE: {
    readonly IMPORT: "IMPORT";
    readonly EXPORT: "EXPORT";
};
export type WarehouseVoucherType = (typeof WAREHOUSE_VOUCHER_TYPE)[keyof typeof WAREHOUSE_VOUCHER_TYPE];
export declare const WAREHOUSE_VOUCHER_TYPES: ("IMPORT" | "EXPORT")[];
