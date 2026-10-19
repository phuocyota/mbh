export const DIRECT_SALES_SQL = `
  SELECT e.id AS "voucherId", COALESCE(e.created_by, 'system') AS "employeeId",
    COALESCE(u.full_name, 'Hệ thống') AS employee,
    TO_CHAR(e.created_at AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS date,
    p.id AS "productId", p.code, p.name, p.unit, p.category_id AS "categoryId", p.product_type AS "productType",
    COALESCE(c.name, 'Chưa phân loại') AS "groupName", e.branch_id AS "branchId", b.name AS "branchName",
    d.quantity::float8 AS qty,
    COALESCE((d.input_details->>'quantity')::numeric * (d.input_details->>'unitPrice')::numeric, 0)::float8 AS total,
    (d.quantity * COALESCE(p.cost_price, 0))::float8 AS cost,
    CASE WHEN e.reason_code = 'BH_BANK' THEN 'BANK_TRANSFER' ELSE 'CASH' END AS method
  FROM stock_receipt_export e
  JOIN stock_receipt_detail d ON d.export_id = e.id AND d.receipt_type = 'EXPORT'
  JOIN products p ON p.id = d.product_id
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN branches b ON b.id = e.branch_id
  LEFT JOIN users u ON u.id::text = e.created_by
  WHERE e.status = 'COMPLETED' AND e.reason_code IN ('BH_CASH', 'BH_BANK')
    AND LOWER(COALESCE(e.reference_type, '')) <> 'order'
    AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = e.reference_id)
    AND e.created_at BETWEEN ($1::timestamptz AT TIME ZONE current_setting('TimeZone'))
      AND ($2::timestamptz AT TIME ZONE current_setting('TimeZone'))
    AND ($3::uuid IS NULL OR e.branch_id = $3::uuid)
`;

export interface DirectSaleRow {
  voucherId: string;
  employeeId: string;
  employee: string;
  productId: string;
  date: string;
  code: string;
  name: string;
  unit: string;
  categoryId?: string;
  productType?: string;
  groupName?: string;
  branchId?: string;
  branchName?: string;
  qty: number;
  total: number;
  cost: number;
  method: string;
}

export function mergeProductSales(
  rows: any[],
  direct: DirectSaleRow[],
  limit: number,
  ascending = false,
) {
  const products = new Map<string, any>();
  for (const row of rows)
    products.set(row.productId, {
      ...row,
      totalQuantity: Number(row.totalQuantity),
      totalRevenue: Number(row.totalRevenue),
    });
  for (const row of direct) {
    const item = products.get(row.productId) || {
      productId: row.productId,
      productName: row.name,
      totalQuantity: 0,
      totalRevenue: 0,
    };
    item.totalQuantity += Number(row.qty);
    item.totalRevenue += Number(row.total);
    products.set(row.productId, item);
  }
  return [...products.values()]
    .sort(
      (a, b) =>
        (ascending ? 1 : -1) * (a.totalQuantity - b.totalQuantity) ||
        a.productName.localeCompare(b.productName),
    )
    .slice(0, limit);
}
