export function convertUnitQuantity(
  quantity: number,
  from: { dimension: string; factorToBase: number },
  to: { dimension: string; factorToBase: number },
) {
  if (
    !(quantity >= 0) ||
    !(Number(from.factorToBase) > 0) ||
    !(Number(to.factorToBase) > 0)
  ) {
    throw new Error('INVALID_UNIT_QUANTITY');
  }
  if (from.dimension !== to.dimension)
    throw new Error('INCOMPATIBLE_UNIT_DIMENSION');
  return (quantity * Number(from.factorToBase)) / Number(to.factorToBase);
}

export function assertKitchenTransition(
  current: string,
  target: string,
  flow: Record<string, string>,
) {
  if (flow[current] !== target) throw new Error('INVALID_KITCHEN_TRANSITION');
}

export function calculateRecipeRequirement(
  itemQuantity: number,
  itemUnit: { dimension: string; factorToBase: number },
  stockUnit: { dimension: string; factorToBase: number },
  servings: number,
  yieldQuantity: number,
) {
  if (!(servings >= 0) || !(yieldQuantity > 0))
    throw new Error('INVALID_RECIPE_YIELD');
  return (
    (convertUnitQuantity(itemQuantity, itemUnit, stockUnit) * servings) /
    yieldQuantity
  );
}
