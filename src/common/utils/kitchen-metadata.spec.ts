import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';
import {
  KitchenProductionBatch,
  Product,
  StockItem,
  StockLot,
  KitchenOperation,
} from '../../entities';

class InspectionSource extends DataSource {
  async inspect() {
    await this.buildMetadatas();
  }
}
describe('Kitchen persistence metadata without database access', () => {
  it('resolves every entity relationship and the new ledger mappings', async () => {
    const db = new InspectionSource({
      type: 'postgres',
      entities: [join(__dirname, '../../entities/*.entity.ts')],
      synchronize: false,
    });
    await db.inspect();
    expect(
      db.getMetadata(Product).findColumnWithPropertyName('productType')
        ?.isNullable,
    ).toBe(true);
    expect(
      db.getMetadata(StockItem).findColumnWithPropertyName('quantity')?.scale,
    ).toBe(4);
    expect(
      db
        .getMetadata(KitchenProductionBatch)
        .findColumnWithPropertyName('mealItemId')?.isNullable,
    ).toBe(true);
    expect(
      db
        .getMetadata(StockLot)
        .uniques.some(
          (u) =>
            u.columns.map((c) => c.propertyName).join(',') ===
            'stockId,productId,lotCode',
        ),
    ).toBe(true);
    expect(
      db.getMetadata(KitchenOperation).findColumnWithPropertyName('version')
        ?.isVersion,
    ).toBe(true);
    expect(db.isInitialized).toBe(false);
    expect(
      db.getMetadata(KitchenOperation).findColumnWithPropertyName('createdAt')
        ?.type,
    ).toBe('timestamptz');
  });
});
