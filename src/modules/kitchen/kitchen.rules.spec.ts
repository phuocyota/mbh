import {
  assertKitchenTransition,
  calculateRecipeRequirement,
  convertUnitQuantity,
} from './kitchen.rules';

describe('kitchen rules', () => {
  it('converts kilograms to grams', () => {
    expect(
      convertUnitQuantity(
        1.5,
        { dimension: 'MASS', factorToBase: 1000 },
        { dimension: 'MASS', factorToBase: 1 },
      ),
    ).toBe(1500);
  });

  it('rejects cross-dimension conversion', () => {
    expect(() =>
      convertUnitQuantity(
        1,
        { dimension: 'MASS', factorToBase: 1 },
        { dimension: 'VOLUME', factorToBase: 1 },
      ),
    ).toThrow('INCOMPATIBLE_UNIT_DIMENSION');
  });

  it('calculates recipe demand by yield', () => {
    expect(
      calculateRecipeRequirement(
        2,
        { dimension: 'MASS', factorToBase: 1000 },
        { dimension: 'MASS', factorToBase: 1 },
        25,
        10,
      ),
    ).toBe(5000);
  });

  it('allows only the next ticket state', () => {
    const flow = {
      WAITING: 'PREPARING',
      PREPARING: 'READY',
      READY: 'DELIVERED',
    };
    expect(() =>
      assertKitchenTransition('WAITING', 'PREPARING', flow),
    ).not.toThrow();
    expect(() => assertKitchenTransition('WAITING', 'READY', flow)).toThrow(
      'INVALID_KITCHEN_TRANSITION',
    );
  });

  it('rejects invalid recipe yield', () => {
    expect(() =>
      calculateRecipeRequirement(
        1,
        { dimension: 'COUNT', factorToBase: 1 },
        { dimension: 'COUNT', factorToBase: 1 },
        10,
        0,
      ),
    ).toThrow('INVALID_RECIPE_YIELD');
  });
});
