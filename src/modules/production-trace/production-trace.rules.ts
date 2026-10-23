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

/** Snapshot the product's use window from the instant the food becomes ready. */
export function servingExpiryFromReady(
  readyAt: Date | string,
  recommendedUseMinutes: number,
) {
  const readyTime = new Date(readyAt).getTime();
  if (!Number.isFinite(readyTime))
    throw new BadRequestException('INVALID_BATCH_READY_TIME');
  if (!Number.isSafeInteger(recommendedUseMinutes) || recommendedUseMinutes <= 0)
    throw new BadRequestException('INVALID_RECOMMENDED_USE_MINUTES');
  const expiry = new Date(readyTime + recommendedUseMinutes * 60_000);
  if (!Number.isFinite(expiry.getTime()))
    throw new BadRequestException('INVALID_RECOMMENDED_USE_MINUTES');
  return expiry.toISOString();
}
