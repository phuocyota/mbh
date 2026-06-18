"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJournalEntryDraft = createJournalEntryDraft;
exports.assertBalancedJournalEntry = assertBalancedJournalEntry;
exports.getJournalEntryTotals = getJournalEntryTotals;
exports.reverseJournalEntryLines = reverseJournalEntryLines;
const constants_js_1 = require("./constants.js");
const errors_js_1 = require("./errors.js");
function createJournalEntryDraft(input) {
    const draft = {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        entryDate: input.entryDate || new Date(),
        description: input.description,
        status: input.status || constants_js_1.JOURNAL_ENTRY_STATUS.POSTED,
        lines: input.lines,
    };
    assertBalancedJournalEntry(draft);
    return draft;
}
function assertBalancedJournalEntry(entry) {
    if (!entry.lines || entry.lines.length < 2) {
        throw new errors_js_1.AccountingRuleError('Journal entry must have at least two lines');
    }
    const totals = getJournalEntryTotals(entry.lines);
    if (totals.debit <= 0 || totals.credit <= 0) {
        throw new errors_js_1.AccountingRuleError('Journal entry must have debit and credit amounts');
    }
    if (totals.debit !== totals.credit) {
        throw new errors_js_1.AccountingRuleError(`Journal entry is not balanced: debit=${totals.debit}, credit=${totals.credit}`);
    }
}
function getJournalEntryTotals(lines) {
    return lines.reduce((totals, line) => {
        const debit = normalizeMoney(line.debit || 0);
        const credit = normalizeMoney(line.credit || 0);
        if (!line.accountCode || !line.accountCode.trim()) {
            throw new errors_js_1.AccountingRuleError('Journal entry line accountCode is required');
        }
        if (debit < 0 || credit < 0) {
            throw new errors_js_1.AccountingRuleError('Journal entry line amounts must not be negative');
        }
        if (debit > 0 && credit > 0) {
            throw new errors_js_1.AccountingRuleError('Journal entry line cannot have both debit and credit');
        }
        if (debit === 0 && credit === 0) {
            throw new errors_js_1.AccountingRuleError('Journal entry line must have a debit or credit amount');
        }
        return {
            debit: normalizeMoney(totals.debit + debit),
            credit: normalizeMoney(totals.credit + credit),
        };
    }, { debit: 0, credit: 0 });
}
function reverseJournalEntryLines(lines) {
    return lines.map((line) => ({
        ...line,
        debit: line.credit || 0,
        credit: line.debit || 0,
    }));
}
function normalizeMoney(value) {
    if (!Number.isFinite(value)) {
        throw new errors_js_1.AccountingRuleError('Journal entry amount must be a number');
    }
    return Math.round(value * 100) / 100;
}
