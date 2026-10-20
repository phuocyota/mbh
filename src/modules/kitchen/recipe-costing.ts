import { convertUnitQuantity } from './kitchen.rules';

// Quantities are gross ingredient input, already including the expected loss.
// Product.costPrice is the cost per stock base unit. Never use selling price.
export function recipeCosting(recipe: any, units: any[]) {
  const missing: string[] = [];
  let total = 0;
  const items = (recipe.items || []).map((item: any) => {
    const product = item.ingredientProduct;
    const base = units.find((unit) => unit.id === product?.baseUnitId);
    const cost = product?.costPrice;
    let baseQuantity: number | null = null;
    try {
      baseQuantity = convertUnitQuantity(
        Number(item.quantity),
        item.unit,
        base,
      );
    } catch {
      /* incomplete reference reported below */
    }
    const valid =
      baseQuantity !== null &&
      Number.isFinite(baseQuantity) &&
      cost != null &&
      Number.isFinite(Number(cost)) &&
      Number(cost) >= 0;
    if (!valid) missing.push(product?.name || item.ingredientProductId);
    const amount = valid ? baseQuantity! * Number(cost) : null;
    if (amount !== null) total += amount;
    return {
      productId: item.ingredientProductId,
      name: product?.name,
      baseQuantity,
      baseUnit: base?.code,
      unitCost: valid ? Number(cost) : null,
      amount,
    };
  });
  if (!items.length) missing.push('Chưa có nguyên liệu');
  const complete = !missing.length && Number(recipe.yieldQuantity) > 0;
  const money = (value: number) =>
    Math.round((value + Number.EPSILON) * 100) / 100;
  return {
    complete,
    missing,
    items,
    totalCost: complete ? money(total) : null,
    costPerServing: complete
      ? money(total / Number(recipe.yieldQuantity))
      : null,
    expectedWastePercent: Number(recipe.expectedWastePercent || 0),
    estimatedWasteCost: complete
      ? money((total * Number(recipe.expectedWastePercent || 0)) / 100)
      : null,
    currency: 'VND',
    basis: 'PRODUCT_COST_PER_BASE_UNIT',
    calculatedAt: new Date().toISOString(),
  };
}
