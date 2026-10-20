import { BadRequestException } from '@nestjs/common';

type Lot = {
  id: string;
  quantity: number | string;
  expiresAt?: string | null;
  createdAt: Date | string;
};

function units(value: number | string) {
  const number = Number(value);
  const scaled = Math.round(number * 10000);
  if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(scaled) ||
    Math.abs(number - scaled / 10000) > 0.0000001)
    throw new BadRequestException('INVALID_FEFO_QUANTITY');
  return scaled;
}

/** Advisory allocation in stock base units. Commit still validates and locks lots. */
export function planFefo<T extends Lot>(quantity: number, lots: T[], today: string, stockQuantity: number | string) {
  const requested = units(quantity);
  if (!requested) throw new BadRequestException('INVALID_FEFO_QUANTITY');
  const eligible = lots.filter((lot) => Number(lot.quantity) > 0 && (!lot.expiresAt || lot.expiresAt >= today))
    .sort((a, b) => {
      const expiry = (a.expiresAt || '9999-12-31').localeCompare(b.expiresAt || '9999-12-31');
      return expiry || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id);
    });
  const totalEligible = eligible.reduce((sum, lot) => sum + units(lot.quantity), 0);
  if (!Number.isSafeInteger(totalEligible)) throw new BadRequestException('INVALID_FEFO_QUANTITY');
  const available = Math.min(totalEligible, units(stockQuantity));
  let remaining = Math.min(requested, available);
  const candidates = eligible.map((lot) => {
    const proposed = Math.min(units(lot.quantity), remaining);
    remaining -= proposed;
    return { ...lot, suggestedQuantity: proposed / 10000 };
  });
  const allocated = Math.min(requested, available);
  return {
    strategy: 'FEFO',
    requestedQuantity: requested / 10000,
    allocatedQuantity: allocated / 10000,
    shortageQuantity: (requested - allocated) / 10000,
    availableQuantity: available / 10000,
    complete: allocated === requested,
    candidates,
    allocations: candidates.filter((lot) => lot.suggestedQuantity > 0)
      .map((lot) => ({ lotId: lot.id, quantity: lot.suggestedQuantity })),
  };
}
