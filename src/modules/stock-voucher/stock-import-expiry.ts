export function defaultFreshFoodExpiry(
  isFreshFood: boolean,
  purchasedAt: string,
  expiresAt?: string,
): string | undefined {
  if (expiresAt || !isFreshFood) return expiresAt;
  const date = new Date(`${purchasedAt}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}
