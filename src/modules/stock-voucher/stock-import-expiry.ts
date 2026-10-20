export const PURCHASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

export function defaultFreshFoodExpiry(
  isFreshFood: boolean,
  purchasedAt: string,
  expiresAt?: string,
): string | undefined {
  if (expiresAt || !isFreshFood) return expiresAt;
  const purchaseDate = purchasedAt.length === 10 ? purchasedAt
    : new Date(new Date(purchasedAt).getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const date = new Date(`${purchaseDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}
