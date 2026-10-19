import { BadRequestException } from '@nestjs/common';
import { localDate } from '../stock/stock-movement.service';

export function traceStatus(
  kind: 'LOT' | 'BATCH' | 'UNIT',
  status: string,
  expiresAt?: string | Date | null,
  now = new Date(),
) {
  const expired =
    expiresAt &&
    (kind === 'LOT'
      ? String(expiresAt) < localDate(now)
      : new Date(expiresAt).getTime() <= now.getTime());
  if (expired) return 'EXPIRED';
  if (kind === 'LOT' || status === 'WAITING') return 'IN STOCK';
  if (status === 'PREPARING') return 'MAKE';
  return 'READY';
}

export function portionCount(quantity: unknown) {
  const count = Number(quantity);
  if (!Number.isSafeInteger(count) || count < 0 || count > 10000)
    throw new BadRequestException(
      'FINISHED_PORTIONS_MUST_BE_INTEGER_0_TO_10000',
    );
  return count;
}
