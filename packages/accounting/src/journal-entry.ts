import {
  AccountingSourceType,
  JOURNAL_ENTRY_STATUS,
  JournalEntryStatus,
} from './constants.js';
import { AccountingRuleError } from './errors.js';

export interface JournalEntryLineDraft {
  accountCode: string;
  debit?: number | null;
  credit?: number | null;
  description?: string | null;
  objectType?: string | null;
  objectId?: string | null;
}

export interface JournalEntryDraft {
  sourceType: AccountingSourceType | string;
  sourceId: string;
  entryDate: Date;
  description?: string | null;
  status: JournalEntryStatus;
  lines: JournalEntryLineDraft[];
}

export function createJournalEntryDraft(input: {
  sourceType: AccountingSourceType | string;
  sourceId: string;
  entryDate?: Date;
  description?: string | null;
  status?: JournalEntryStatus;
  lines: JournalEntryLineDraft[];
}): JournalEntryDraft {
  const draft: JournalEntryDraft = {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    entryDate: input.entryDate || new Date(),
    description: input.description,
    status: input.status || JOURNAL_ENTRY_STATUS.POSTED,
    lines: input.lines,
  };

  assertBalancedJournalEntry(draft);
  return draft;
}

export function assertBalancedJournalEntry(entry: {
  lines: JournalEntryLineDraft[];
}) {
  if (!entry.lines || entry.lines.length < 2) {
    throw new AccountingRuleError('Journal entry must have at least two lines');
  }

  const totals = getJournalEntryTotals(entry.lines);
  if (totals.debit <= 0 || totals.credit <= 0) {
    throw new AccountingRuleError(
      'Journal entry must have debit and credit amounts',
    );
  }

  if (totals.debit !== totals.credit) {
    throw new AccountingRuleError(
      `Journal entry is not balanced: debit=${totals.debit}, credit=${totals.credit}`,
    );
  }
}

export function getJournalEntryTotals(lines: JournalEntryLineDraft[]) {
  return lines.reduce(
    (totals, line) => {
      const debit = normalizeMoney(line.debit || 0);
      const credit = normalizeMoney(line.credit || 0);

      if (!line.accountCode || !line.accountCode.trim()) {
        throw new AccountingRuleError(
          'Journal entry line accountCode is required',
        );
      }

      if (debit < 0 || credit < 0) {
        throw new AccountingRuleError(
          'Journal entry line amounts must not be negative',
        );
      }

      if (debit > 0 && credit > 0) {
        throw new AccountingRuleError(
          'Journal entry line cannot have both debit and credit',
        );
      }

      if (debit === 0 && credit === 0) {
        throw new AccountingRuleError(
          'Journal entry line must have a debit or credit amount',
        );
      }

      return {
        debit: normalizeMoney(totals.debit + debit),
        credit: normalizeMoney(totals.credit + credit),
      };
    },
    { debit: 0, credit: 0 },
  );
}

export function reverseJournalEntryLines(lines: JournalEntryLineDraft[]) {
  return lines.map((line) => ({
    ...line,
    debit: line.credit || 0,
    credit: line.debit || 0,
  }));
}

function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) {
    throw new AccountingRuleError('Journal entry amount must be a number');
  }

  return Math.round(value * 100) / 100;
}
