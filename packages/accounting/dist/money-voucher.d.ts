import { MoneyVoucherType } from './constants.js';
export declare function normalizeMoneyVoucherType(type: string): MoneyVoucherType;
export declare function createMoneyVoucherCode(type: MoneyVoucherType, now?: number): string;
export declare function getFundBalanceAfterVoucher(params: {
    type: MoneyVoucherType;
    currentBalance: number;
    amount: number;
}): number;
export declare function defaultAccountingSourceType(refType?: string | null): string;
