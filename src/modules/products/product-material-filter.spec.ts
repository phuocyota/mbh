import { ProductService } from './product.service';

function harness() {
  const query: any = {};
  for (const name of [
    'leftJoinAndSelect',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'clone',
    'select',
    'offset',
    'limit',
  ])
    query[name] = jest.fn(() => query);
  query.getRawMany = jest.fn(async () => []);
  query.getCount = jest.fn(async () => 0);
  const service = new ProductService(
    { createQueryBuilder: () => query } as any,
    {} as any,
    {} as any,
  );
  return { service, query };
}

describe('product material API filter', () => {
  it.each(['MISSING', 'PENDING_REVIEW'])(
    'filters %s recipes within branch before counting and pagination',
    async (recipeStatus) => {
      const { service, query } = harness();
      await service.findProducts('food', {
        branchId: 'branch',
        recipeStatus,
        page: 2,
        size: 10,
        search: 'bánh',
      });
      expect(query.andWhere).toHaveBeenCalledWith(
        "p.product_type = 'FINISHED_GOOD'",
      );
      const clause = query.andWhere.mock.calls.find(([sql]) =>
        sql.includes('kitchen_recipes'),
      );
      expect(clause[0]).toContain(
        'r.product_id=p.id AND r.branch_id=:recipeBranchId',
      );
      expect(clause[1]).toEqual({ recipeBranchId: 'branch' });
      expect(clause[0]).toContain(
        recipeStatus === 'MISSING' ? 'NOT EXISTS' : "r.status='PENDING_REVIEW'",
      );
      expect(query.andWhere.mock.invocationCallOrder.at(-1)).toBeLessThan(
        query.clone.mock.invocationCallOrder[0],
      );
      expect(query.offset).toHaveBeenCalledWith(10);
      expect(query.andWhere).toHaveBeenCalledWith(
        'p.category_id = :categoryId',
        { categoryId: 'food' },
      );
    },
  );
  it('rejects unsupported recipe states or an unspecified branch', async () => {
    const { service, query } = harness();
    await expect(
      service.findProducts(undefined, {
        recipeStatus: 'ACTIVE',
        branchId: 'b',
      }),
    ).rejects.toThrow('INVALID_RECIPE_STATUS');
    await expect(
      service.findProducts(undefined, { recipeStatus: 'MISSING' }),
    ).rejects.toThrow('chọn chi nhánh');
    expect(query.getRawMany).not.toHaveBeenCalled();
  });
  it('filters ingredients and fuel together before pagination and counting, preserving branch and search', async () => {
    const { service, query } = harness();
    await service.findProducts(undefined, {
      productType: 'INGREDIENT,FUEL',
      branchId: 'branch',
      search: 'thịt',
      page: 2,
      size: 50,
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      'p.product_type IN (:...productTypes)',
      { productTypes: ['INGREDIENT', 'FUEL'] },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('p.branch_id'),
      { branchId: 'branch' },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(p.name)'),
      { search: '%thịt%' },
    );
    expect(query.andWhere.mock.invocationCallOrder.at(-1)).toBeLessThan(
      query.clone.mock.invocationCallOrder[0],
    );
    expect(query.offset).toHaveBeenCalledWith(50);
    expect(query.getCount).toHaveBeenCalledTimes(1);
  });
  it('keeps single-type and unfiltered requests working', async () => {
    const { service, query } = harness();
    await service.findProducts(undefined, { productType: 'FUEL' });
    expect(query.andWhere).toHaveBeenCalledWith(
      'p.product_type IN (:...productTypes)',
      { productTypes: ['FUEL'] },
    );
    query.andWhere.mockClear();
    await service.findProducts();
    expect(
      query.andWhere.mock.calls.some(([sql]) => sql.includes('product_type')),
    ).toBe(false);
  });
  it('rejects invalid type values before executing SQL', async () => {
    const { service, query } = harness();
    await expect(
      service.findProducts(undefined, { productType: 'INGREDIENT,UNKNOWN' }),
    ).rejects.toThrow('INVALID_PRODUCT_TYPE');
    expect(query.getRawMany).not.toHaveBeenCalled();
  });
});
