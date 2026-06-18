import {
  ACCOUNTING_SOURCE_TYPE,
  MONEY_VOUCHER_CODE_PREFIX,
  MONEY_VOUCHER_TYPE,
  MONEY_VOUCHER_TYPES,
  MoneyVoucherType,
  PURPOSE_ACCOUNT_MAP,
} from './constants.js';
import { AccountingRuleError } from './errors.js';

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

export function normalizeMoneyVoucherType(type: string): MoneyVoucherType {
  const normalized = String(type || '').toUpperCase();
  if (!MONEY_VOUCHER_TYPES.includes(normalized as MoneyVoucherType)) {
    throw new AccountingRuleError(
      'Money voucher type must be RECEIPT or PAYMENT',
    );
  }

  return normalized as MoneyVoucherType;
}

export function createMoneyVoucherCode(
  type: MoneyVoucherType,
  now = Date.now(),
) {
  return `${MONEY_VOUCHER_CODE_PREFIX[type]}${now}`;
}

export function getFundBalanceAfterVoucher(params: {
  type: MoneyVoucherType;
  currentBalance: number;
  amount: number;
}) {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new AccountingRuleError(
      'Money voucher amount must be greater than 0',
    );
  }

  const nextBalance =
    params.type === MONEY_VOUCHER_TYPE.RECEIPT
      ? params.currentBalance + params.amount
      : params.currentBalance - params.amount;

  if (nextBalance < 0) {
    throw new AccountingRuleError('Fund balance is not enough');
  }

  return nextBalance;
}

export function resolveMoneyVoucherPosting(
  input: MoneyVoucherPostingInput,
): MoneyVoucherPosting {
  const type = normalizeMoneyVoucherType(input.type);
  const explicitDebit = normalizeOptionalAccountCode(input.debitAccountCode);
  const explicitCredit = normalizeOptionalAccountCode(input.creditAccountCode);

  if (explicitDebit && explicitCredit) {
    return {
      type,
      debitAccountCode: explicitDebit,
      creditAccountCode: explicitCredit,
    };
  }

  const purpose = String(input.purpose || '').toUpperCase();
  const mapping =
    PURPOSE_ACCOUNT_MAP[purpose as keyof typeof PURPOSE_ACCOUNT_MAP];
  if (!mapping) {
    throw new AccountingRuleError(
      `Accounting account mapping is required for purpose: ${purpose || 'OTHER'}`,
    );
  }

  if (type === MONEY_VOUCHER_TYPE.RECEIPT) {
    const creditAccountCode = explicitCredit || mapping.receiptAccountCode;
    if (!creditAccountCode) {
      throw new AccountingRuleError(
        `Receipt account mapping is required for purpose: ${purpose}`,
      );
    }

    return {
      type,
      debitAccountCode: explicitDebit || input.fundAccountCode,
      creditAccountCode,
    };
  }

  const debitAccountCode = explicitDebit || mapping.paymentAccountCode;
  if (!debitAccountCode) {
    throw new AccountingRuleError(
      `Payment account mapping is required for purpose: ${purpose}`,
    );
  }

  return {
    type,
    debitAccountCode,
    creditAccountCode: explicitCredit || input.fundAccountCode,
  };
}

export function defaultAccountingSourceType(refType?: string | null) {
  return refType || ACCOUNTING_SOURCE_TYPE.MONEY_VOUCHER;
}

function normalizeOptionalAccountCode(value?: string | null) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}
