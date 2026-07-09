import {
  ACCOUNTING_SOURCE_TYPE,
  MONEY_VOUCHER_CODE_PREFIX,
  MONEY_VOUCHER_TYPE,
  MONEY_VOUCHER_TYPES,
  MoneyVoucherType,
} from './constants.js';
import { AccountingRuleError } from './errors.js';

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

export function defaultAccountingSourceType(refType?: string | null) {
  return refType || ACCOUNTING_SOURCE_TYPE.MONEY_VOUCHER;
}
