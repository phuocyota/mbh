import { AccountingSourceType, JournalEntryStatus } from './constants.js';
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
export declare function createJournalEntryDraft(input: {
    sourceType: AccountingSourceType | string;
    sourceId: string;
    entryDate?: Date;
    description?: string | null;
    status?: JournalEntryStatus;
    lines: JournalEntryLineDraft[];
}): JournalEntryDraft;
export declare function assertBalancedJournalEntry(entry: {
    lines: JournalEntryLineDraft[];
}): void;
export declare function getJournalEntryTotals(lines: JournalEntryLineDraft[]): {
    debit: number;
    credit: number;
};
export declare function reverseJournalEntryLines(lines: JournalEntryLineDraft[]): {
    debit: number;
    credit: number;
    accountCode: string;
    description?: string | null;
    objectType?: string | null;
    objectId?: string | null;
}[];
