/** Quantity offered for sale, scoped to the authenticated branch. */
export function saleQuantitySql(branchId?: string): string {
  const warehouseQuantity = `(SELECT COALESCE(SUM(si.quantity), 0)
    FROM stock_items si
    INNER JOIN stocks stock ON stock.id = si.stock_id
    WHERE si.product_id = product.id
    ${branchId ? 'AND stock.branch_id = :branchId' : ''})`;

  // Invert calculateRecipeRequirement: the limiting recipe input determines
  // whole portions. Keep recipe yield and unit conversion consistent with kitchen.
  // LEFT JOINs ensure an invalid/missing input gives zero instead of being skipped.
  const producibleQuantity = branchId
    ? `(SELECT COALESCE(FLOOR(MIN(
          CASE WHEN recipe.yield_quantity > 0 AND item.quantity > 0
            AND item_unit.factor_to_base > 0 AND stock_unit.factor_to_base > 0
            AND item_unit.dimension = stock_unit.dimension
          THEN (
            SELECT COALESCE(SUM(
              CASE WHEN ingredient.lot_tracking_enabled THEN
                LEAST(GREATEST(0, si.quantity), COALESCE(lots.usable, 0))
              ELSE GREATEST(0, si.quantity - COALESCE(lots.expired, 0)) END
            ), 0)
            FROM stock_items si
            INNER JOIN stocks stock ON stock.id = si.stock_id
            LEFT JOIN LATERAL (
              SELECT SUM(lot.quantity) FILTER (
                  WHERE lot.expires_at IS NULL OR lot.expires_at >=
                    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                ) AS usable,
                SUM(lot.quantity) FILTER (
                  WHERE lot.expires_at <
                    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                ) AS expired
              FROM stock_lots lot
              WHERE lot.stock_id = si.stock_id
                AND lot.product_id = si.product_id AND lot.quantity > 0
            ) lots ON true
            WHERE stock.branch_id = :branchId
              AND si.product_id = item.ingredient_product_id
          ) * recipe.yield_quantity * stock_unit.factor_to_base
            / NULLIF(item.quantity * item_unit.factor_to_base, 0)
          ELSE 0 END
        )), 0)
        FROM (
          SELECT r.id, r.yield_quantity FROM kitchen_recipes r
          WHERE r.branch_id = :branchId AND r.product_id = product.id
            AND r.status = 'ACTIVE'
            AND (r.effective_from IS NULL OR r.effective_from <= CURRENT_TIMESTAMP)
          ORDER BY r.version DESC LIMIT 1
        ) recipe
        LEFT JOIN kitchen_recipe_items item ON item.recipe_id = recipe.id
        LEFT JOIN products ingredient ON ingredient.id = item.ingredient_product_id
        LEFT JOIN measurement_units item_unit ON item_unit.id = item.unit_id
        LEFT JOIN measurement_units stock_unit ON stock_unit.id = ingredient.base_unit_id)`
    : '0';

  return `CASE WHEN product.requires_cooking = true
      OR product.product_type = 'FINISHED_GOOD'
    THEN ${producibleQuantity}
    ELSE ${warehouseQuantity} END`;
}
