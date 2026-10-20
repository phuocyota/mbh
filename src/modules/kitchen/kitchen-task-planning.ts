import { BadRequestException } from '@nestjs/common';

export function scaleTaskDish(dish: any, quantity: number) {
  return {
    ...dish,
    quantity,
    requirements: dish.requirements.map((line: any) => ({
      ...line,
      quantity: Number(
        ((Number(line.quantity) * quantity) / dish.quantity).toFixed(4),
      ),
    })),
  };
}

/** Progress counts complete planned portions, never a percentage of ingredient weight. */
export function remainingTaskSnapshot(original: any, rounds: any[]) {
  const completed = new Map<string, number>();
  for (const round of rounds)
    for (const dish of round.snapshot.dishes)
      completed.set(
        dish.productId,
        (completed.get(dish.productId) || 0) + dish.quantity,
      );
  return {
    ...original,
    dishes: original.dishes
      .map((dish: any) =>
        scaleTaskDish(
          dish,
          Math.max(0, dish.quantity - (completed.get(dish.productId) || 0)),
        ),
      )
      .filter((dish: any) => dish.quantity > 0),
  };
}

export function selectTaskRound(
  snapshot: any,
  inputs: any[],
  allowPartial: boolean,
) {
  if (
    !Array.isArray(inputs) ||
    !inputs.length ||
    inputs.length > snapshot.dishes.length ||
    inputs.some((row) => !row || typeof row !== 'object') ||
    new Set(inputs.map((row) => row.productId)).size !== inputs.length
  )
    throw new BadRequestException(
      'Chọn các món và số suất hợp lệ cho đợt này.',
    );
  const dishes = inputs.map((input) => {
    const dish = snapshot.dishes.find(
      (row: any) => row.productId === input.productId,
    );
    const quantity =
      input.quantity === undefined ? dish?.quantity : Number(input.quantity);
    if (
      !dish ||
      (input.quantity !== undefined &&
        !['number', 'string'].includes(typeof input.quantity)) ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > dish.quantity ||
      quantity > 10000
    )
      throw new BadRequestException(
        'Số suất của đợt phải là số nguyên và không vượt số suất còn lại.',
      );
    if (!allowPartial && quantity !== dish.quantity)
      throw new BadRequestException('Mẻ kế hoạch cần nhận đủ số lượng đã lập.');
    return scaleTaskDish(dish, quantity);
  });
  if (!allowPartial && dishes.length !== snapshot.dishes.length)
    throw new BadRequestException('Cần xác nhận nguyên liệu cho đủ các món.');
  return { ...snapshot, dishes };
}

/** Lots must already be branch scoped, unexpired, stock capped and FEFO sorted. */
export function planTaskRound(snapshot: any, lots: any[]) {
  const balances = new Map(
    lots.map((lot) => [lot.id, Math.round(Number(lot.quantity) * 10000)]),
  );
  return snapshot.dishes.map((dish: any) => {
    const required = (quantity: number) => {
      const totals = new Map<string, number>();
      for (const line of scaleTaskDish(dish, quantity).requirements)
        totals.set(
          line.productId,
          (totals.get(line.productId) || 0) + Math.round(line.quantity * 10000),
        );
      return totals;
    };
    const fits = (quantity: number) =>
      [...required(quantity)].every(
        ([productId, needed]) =>
          lots
            .filter((lot) => lot.productId === productId)
            .reduce((sum, lot) => sum + (balances.get(lot.id) || 0), 0) >=
          needed,
      );
    let low = 0,
      high = Math.min(10000, Math.floor(dish.quantity));
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (fits(mid)) low = mid;
      else high = mid - 1;
    }
    const inputLots: any[] = [];
    for (const [productId, need] of required(low)) {
      let left = need;
      for (const lot of lots.filter((row) => row.productId === productId)) {
        const take = Math.min(left, balances.get(lot.id) || 0);
        if (take > 0) {
          inputLots.push({ lotId: lot.id, quantity: take / 10000 });
          balances.set(lot.id, balances.get(lot.id)! - take);
          left -= take;
        }
      }
    }
    return {
      productId: dish.productId,
      name: dish.name,
      quantity: low,
      remainingQuantity: dish.quantity - low,
      inputLots,
    };
  });
}
