import { MoneyVoucherType } from './constants.js';
export interface MoneyVoucherPostingInput {
    type: string;
    fundAccountCode: string;
    purpose?: string | null;
    debitAccountCode?: string | null;
    creditAccountCode?: string | null;
}
export interface MoneyVoucherPosting {
    type: MoneyVoucherType;
    debitAccountCode: string;
    creditAccountCode: string;
}
export declare function normalizeMoneyVoucherType(type: string): MoneyVoucherType;
export declare function createMoneyVoucherCode(type: MoneyVoucherType, now?: number): string;
export declare function getFundBalanceAfterVoucher(params: {
    type: MoneyVoucherType;
    currentBalance: number;
    amount: number;
}): number;
export declare function resolveMoneyVoucherPosting(input: MoneyVoucherPostingInput): MoneyVoucherPosting;
export declare function defaultAccountingSourceType(refType?: string | null): string;
