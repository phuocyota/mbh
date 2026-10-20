import { recipeCosting } from './recipe-costing';

describe('Recipe estimated costing', () => {
  const gram = { id: 'g', code: 'g', dimension: 'MASS', factorToBase: 1 };
  const kilo = { id: 'kg', code: 'kg', dimension: 'MASS', factorToBase: 1000 };
  const recipe = {
    yieldQuantity: 2,
    expectedWastePercent: 10,
    items: [
      {
        ingredientProductId: 'pork',
        quantity: 0.1,
        unit: kilo,
        ingredientProduct: { name: 'Chả', baseUnitId: 'g', costPrice: 100 },
      },
    ],
  };
  it('converts units and counts input costs once including expected waste', () => {
    const cost = recipeCosting(recipe, [gram, kilo]);
    expect(cost.complete).toBe(true);
    expect(cost.totalCost).toBe(10000);
    expect(cost.costPerServing).toBe(5000);
    expect(cost.estimatedWasteCost).toBe(1000);
    expect(cost.items[0].baseQuantity).toBe(100);
  });
  it('does not substitute selling price for unknown cost', () => {
    const item = recipe.items[0];
    const cost = recipeCosting(
      {
        ...recipe,
        items: [
          {
            ...item,
            ingredientProduct: {
              ...item.ingredientProduct,
              costPrice: null,
              price: 999,
            },
          },
        ],
      },
      [gram],
    );
    expect(cost.complete).toBe(false);
    expect(cost.totalCost).toBeNull();
    expect(cost.missing).toEqual(['Chả']);
  });
});
