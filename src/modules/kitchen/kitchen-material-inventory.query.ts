// Reconstruct historical balances from current stock and subsequent ledger
// movements, as in WarehouseService. Aggregate independently to avoid fan-out.
export const kitchenMaterialInventorySql = `
WITH balances AS (
  SELECT si.product_id, SUM(si.quantity) AS quantity
  FROM stock_items si JOIN stocks s ON s.id=si.stock_id
  WHERE s.branch_id=$1 GROUP BY si.product_id
), movements AS (
  SELECT m.product_id,
    SUM(m.quantity) AS since_start,
    COALESCE(SUM(m.quantity) FILTER (WHERE m.created_at >= ($3::date+1) AT TIME ZONE 'Asia/Ho_Chi_Minh'),0) AS after_end,
    COALESCE(SUM(GREATEST(m.quantity,0)) FILTER (WHERE m.created_at < ($3::date+1) AT TIME ZONE 'Asia/Ho_Chi_Minh'),0) AS incoming,
    COALESCE(SUM(GREATEST(-m.quantity,0)) FILTER (WHERE m.created_at < ($3::date+1) AT TIME ZONE 'Asia/Ho_Chi_Minh'),0) AS outgoing
  FROM stock_movements m JOIN stocks s ON s.id=m.stock_id
  WHERE s.branch_id=$1 AND m.created_at >= $2::date AT TIME ZONE 'Asia/Ho_Chi_Minh'
  GROUP BY m.product_id
), scope AS (
  SELECT product_id FROM balances UNION SELECT product_id FROM movements
)
SELECT p.id, p.id AS "productId", p.code, p.name, p.product_type AS "productType",
  COALESCE(u.code,NULLIF(p.unit,''),'Chưa có đơn vị') AS unit,
  COALESCE(b.quantity,0)-COALESCE(m.since_start,0) AS "openingQuantity",
  COALESCE(m.incoming,0) AS "incomingQuantity", COALESCE(m.outgoing,0) AS "outgoingQuantity",
  COALESCE(b.quantity,0)-COALESCE(m.after_end,0) AS "closingQuantity"
FROM scope JOIN products p ON p.id=scope.product_id
LEFT JOIN balances b ON b.product_id=p.id LEFT JOIN movements m ON m.product_id=p.id
LEFT JOIN measurement_units u ON u.id=p.base_unit_id
WHERE p.product_type IN ('INGREDIENT','FUEL')
ORDER BY p.name,p.id`;
