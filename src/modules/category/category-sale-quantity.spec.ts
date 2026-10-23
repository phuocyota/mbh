import { CategoryService } from './category.service';
import { saleQuantitySql } from './sale-quantity';

function harness(categories: any[], quantities: any[]) {
  const catalog: any = {};
  for (const method of [
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
  ])
    catalog[method] = jest.fn().mockReturnValue(catalog);
  catalog.getMany = jest.fn().mockResolvedValue(categories);
  const inventory: any = {};
  for (const method of ['select', 'addSelect', 'where', 'setParameter'])
    inventory[method] = jest.fn().mockReturnValue(inventory);
  inventory.getRawMany = jest.fn().mockResolvedValue(quantities);
  const repo: any = {
    createQueryBuilder: () => catalog,
    manager: { getRepository: () => ({ createQueryBuilder: () => inventory }) },
  };
  return { service: new CategoryService(repo), catalog, inventory };
}

describe('Sale quantities in the parent product catalog', () => {
  it('returns cooked bread and merchandise quantities in both response fields', async () => {
    const h = harness(
      [
        {
          id: 'food',
          products: [
            { id: 'bread', requiresCooking: true },
            { id: 'milk' },
            { id: 'empty' },
          ],
        },
      ],
      [
        { productId: 'bread', quantity: '12' },
        { productId: 'milk', quantity: '3' },
      ],
    );
    const result = await h.service.findActiveWithProducts({
      branchId: 'branch-a',
    });
    expect(result.data[0].products).toEqual([
      { id: 'bread', requiresCooking: true, remain: 12, quantity: 12 },
      { id: 'milk', remain: 3, quantity: 3 },
      { id: 'empty', remain: 0, quantity: 0 },
    ]);
    expect(h.inventory.setParameter).toHaveBeenCalledWith(
      'branchId',
      'branch-a',
    );
  });

  it('filters using the same sale quantity before removing empty categories and paginating', async () => {
    const h = harness(
      [
        { id: 'empty', products: [] },
        { id: 'food', products: [{ id: 'bread' }] },
        { id: 'drinks', products: [{ id: 'milk' }] },
      ],
      [{ productId: 'bread', quantity: '5' }],
    );
    const result = await h.service.findActiveWithProducts({
      branchId: 'branch-a',
      hasInventory: true,
      size: 1,
    });
    expect(result.total).toBe(2);
    expect(result.data.map((c) => c.id)).toEqual(['food']);
    expect(h.catalog.leftJoinAndSelect.mock.calls[0][2]).toContain(
      `(${saleQuantitySql('branch-a')}) > 0`,
    );
    expect(h.inventory.addSelect).toHaveBeenCalledWith(
      saleQuantitySql('branch-a'),
      'quantity',
    );
    expect(h.inventory.where).toHaveBeenCalledWith(
      'product.id IN (:...productIds)',
      { productIds: ['bread'] },
    );
  });

  it('uses only active, unexpired available finished lots for cooked products', () => {
    const sql = saleQuantitySql('branch-a');
    expect(sql).toContain('product.requires_cooking = true');
    expect(sql).toContain("product.product_type = 'FINISHED_GOOD'");
    expect(sql).toContain('lot.branch_id = :branchId');
    expect(sql).toContain("lot.kind = 'finished-inventory'");
    expect(sql).toContain("lot.status = 'ACTIVE'");
    expect(sql).toContain("lot.payload->>'productId' = product.id::text");
    expect(sql).toContain(
      "(lot.payload->>'expiresAt')::timestamptz > CURRENT_TIMESTAMP",
    );
    expect(sql).toContain("lot.payload->>'availableQuantity'");
    expect(sql).not.toContain('quarantinedQuantity');
    expect(sql).toContain('stock.branch_id = :branchId');
  });

  it('does not read finished inventory across branches for a shared catalog', async () => {
    const h = harness([{ id: 'food', products: [{ id: 'bread' }] }], []);
    await h.service.findActiveWithProducts({ hasInventory: true });
    expect(saleQuantitySql()).not.toContain('kitchen_operations');
    expect(h.inventory.getRawMany).not.toHaveBeenCalled();
  });
});
