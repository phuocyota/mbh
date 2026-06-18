export class OrderRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderRuleError';
  }
}
