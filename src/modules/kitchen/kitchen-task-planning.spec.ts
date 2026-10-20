import {
  planTaskRound,
  remainingTaskSnapshot,
  scaleTaskDish,
  selectTaskRound,
} from './kitchen-task-planning';

const dish = {
  productId: 'bread',
  name: 'Bánh mì',
  quantity: 100,
  requirements: [
    { productId: 'roll', quantity: 100 },
    { productId: 'pork', quantity: 4000 },
    { productId: 'veg', quantity: 2000 },
  ],
};
const snapshot = { dishes: [dish], missingRecipes: [] };
const lots = [
  { id: 'roll-lot', productId: 'roll', quantity: 100 },
  { id: 'pork-early', productId: 'pork', quantity: 1000 },
  { id: 'pork-later', productId: 'pork', quantity: 2000 },
  { id: 'veg-lot', productId: 'veg', quantity: 2000 },
];

describe('Complete-portion production planning', () => {
  it('produces 75 complete portions using the limiting ingredient and splits FEFO lots', () => {
    expect(planTaskRound(snapshot, lots)).toEqual([
      {
        productId: 'bread',
        name: 'Bánh mì',
        quantity: 75,
        remainingQuantity: 25,
        inputLots: [
          { lotId: 'roll-lot', quantity: 75 },
          { lotId: 'pork-early', quantity: 1000 },
          { lotId: 'pork-later', quantity: 2000 },
          { lotId: 'veg-lot', quantity: 1500 },
        ],
      },
    ]);
  });
  it('does not suggest portions with a missing component or count the same stock for two dishes', () => {
    expect(
      planTaskRound(
        snapshot,
        lots.filter((lot) => lot.productId !== 'veg'),
      )[0].quantity,
    ).toBe(0);
    const shared = {
      dishes: [
        scaleTaskDish(dish, 50),
        { ...scaleTaskDish(dish, 50), productId: 'bread-2' },
      ],
    };
    expect(planTaskRound(shared, lots).map((row) => row.quantity)).toEqual([
      50, 25,
    ]);
  });
  it('leaves exactly 25 portions with unchanged per-portion quantities after completing 75', () => {
    const round = selectTaskRound(
      snapshot,
      [{ productId: 'bread', quantity: 75 }],
      true,
    );
    const remaining = remainingTaskSnapshot(snapshot, [{ snapshot: round }]);
    expect(remaining.dishes[0].quantity).toBe(25);
    expect(remaining.dishes[0].requirements.map((row) => row.quantity)).toEqual(
      [25, 1000, 500],
    );
    expect(
      remainingTaskSnapshot(snapshot, [
        { snapshot: round },
        { snapshot: remaining },
      ]).dishes,
    ).toEqual([]);
  });
  it.each([0, -1, 101, 0.75, true, null, ''])(
    'rejects an invalid round size %p',
    (quantity) => {
      expect(() =>
        selectTaskRound(snapshot, [{ productId: 'bread', quantity }], true),
      ).toThrow();
    },
  );
  it('rejects unknown/duplicate dishes and partial planned batches', () => {
    expect(() =>
      selectTaskRound(snapshot, [{ productId: 'unknown', quantity: 1 }], true),
    ).toThrow();
    expect(() =>
      selectTaskRound(
        snapshot,
        [
          { productId: 'bread', quantity: 1 },
          { productId: 'bread', quantity: 1 },
        ],
        true,
      ),
    ).toThrow();
    expect(() =>
      selectTaskRound(snapshot, [{ productId: 'bread', quantity: 75 }], false),
    ).toThrow();
  });
  it('handles four-decimal stock without rounding up a portion', () => {
    const fractional = {
      dishes: [
        {
          productId: 'd',
          name: 'd',
          quantity: 100,
          requirements: [{ productId: 'p', quantity: 33.33 }],
        },
      ],
    };
    expect(
      planTaskRound(fractional, [
        { id: 'p', productId: 'p', quantity: 24.9974 },
      ])[0].quantity,
    ).toBe(74);
  });
});
