/** Quantity offered for sale, scoped to the authenticated branch. */
export function saleQuantitySql(branchId?: string): string {
  const warehouseQuantity = `(SELECT COALESCE(SUM(si.quantity), 0)
    FROM stock_items si
    INNER JOIN stocks stock ON stock.id = si.stock_id
    WHERE si.product_id = product.id
    ${branchId ? 'AND stock.branch_id = :branchId' : ''})`;

  // A shared catalog has no branch inventory to offer for cooked dishes.
  const finishedQuantity = branchId
    ? `(SELECT COALESCE(SUM(GREATEST(0,
          COALESCE((lot.payload->>'availableQuantity')::numeric, 0))), 0)
        FROM kitchen_operations lot
        WHERE lot.branch_id = :branchId
          AND lot.kind = 'finished-inventory'
          AND lot.status = 'ACTIVE'
          AND lot.payload->>'productId' = product.id::text
          AND (lot.payload->>'expiresAt')::timestamptz > CURRENT_TIMESTAMP)`
    : '0';

  return `CASE WHEN product.requires_cooking = true
      OR product.product_type = 'FINISHED_GOOD'
    THEN ${finishedQuantity}
    ELSE ${warehouseQuantity} END`;
}
