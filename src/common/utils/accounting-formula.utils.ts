/**
 * Parse an accounting formula string like "{1561:-,1111:+,1331:-}"
 * into structured entries of { accountCode, sign }.
 */
export interface AccountingFormulaEntry {
  accountCode: string;
  sign: '+' | '-';
}

export function parseAccountingFormula(
  formula: string | undefined | null,
): AccountingFormulaEntry[] {
  if (!formula) {
    return [];
  }

  return formula
    .replace(/[{}]/g, '')
    .split(',')
    .map((entry) => {
      const [accountCode, sign] = entry
        .split(':')
        .map((part) => part.trim());

      return { accountCode, sign };
    })
    .filter(
      (entry): entry is AccountingFormulaEntry =>
        !!entry.accountCode && ['+', '-'].includes(entry.sign),
    );
}

/**
 * Get the first account code matching a given sign ('+' or '-') from a formula.
 */
export function getFormulaAccount(
  formula: string | undefined | null,
  sign: '+' | '-',
): string | undefined {
  return parseAccountingFormula(formula).find(
    (entry) => entry.sign === sign,
  )?.accountCode;
}
