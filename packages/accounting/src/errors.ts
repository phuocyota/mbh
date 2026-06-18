export class AccountingRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingRuleError';
  }
}
