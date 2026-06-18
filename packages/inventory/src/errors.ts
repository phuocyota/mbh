export class InventoryRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryRuleError';
  }
}
