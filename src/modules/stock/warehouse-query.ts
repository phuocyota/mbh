import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { localDate } from './stock-movement.service';
import { stockProductCondition } from './stock-scope';

export function warehouseDate(value: unknown, fallback: string) {
  if (value === undefined || value === '') return fallback;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Ngày phải hợp lệ theo YYYY-MM-DD.');
  return value;
}
export function warehouseRange(q: any) {
  const to = warehouseDate(q.to, localDate());
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  const from = warehouseDate(q.from, start.toISOString().slice(0, 10));
  if (
    from > to ||
    (Date.parse(to) - Date.parse(from)) / 86400000 > 365 ||
    to > localDate()
  )
    throw new BadRequestException(
      'Khoảng ngày tối đa 366 ngày và không vượt ngày hiện tại.',
    );
  return { from, to };
}
export function warehouseFilters(q: any, branchId: string) {
  for (const key of ['search', 'lotCode']) {
    if (q[key] !== undefined && typeof q[key] !== 'string')
      throw new BadRequestException(`Invalid ${key}`);
  }
  const params: any[] = [branchId];
  const clauses: string[] = [];
  const add = (sql: string, value: any) => {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  };
  for (const [key, column] of [
    ['stockId', '"stockId"'],
    ['categoryId', '"categoryId"'],
    ['productId', '"productId"'],
  ]) {
    if (q[key]) {
      if (!isUUID(q[key])) throw new BadRequestException(`Invalid ${key}`);
      add(`${column}=?::uuid`, q[key]);
    }
  }
  if (q.search?.trim())
    add(
      `(name ILIKE ? OR code ILIKE $${params.length + 1})`,
      `%${String(q.search).trim()}%`,
    );
  if (q.productType) {
    if (
      !['INGREDIENT', 'FUEL', 'FINISHED_GOOD', 'MERCHANDISE'].includes(
        q.productType,
      )
    )
      throw new BadRequestException('INVALID_PRODUCT_TYPE');
    add('"productType"=?', q.productType);
  }
  if (q.status) {
    const status: Record<string, string> = {
      LOW: '"minimumStock" IS NOT NULL AND quantity < "minimumStock"',
      OUT: 'quantity <= 0',
      AVAILABLE: '"availableQuantity" > 0',
      EXPIRED: '"expiredQuantity" > 0',
      EXPIRING: '"expiringQuantity" > 0',
    };
    if (!status[q.status])
      throw new BadRequestException('INVALID_STOCK_STATUS');
    clauses.push(status[q.status]);
  }
  if (q.lotCode?.trim())
    add(
      `EXISTS(SELECT 1 FROM stock_lots fl WHERE fl.stock_id="stockId" AND fl.product_id="productId" AND fl.lot_code ILIKE ?)`,
      `%${String(q.lotCode).trim()}%`,
    );
  if (q.expiresFrom || q.expiresTo) {
    const from = warehouseDate(q.expiresFrom, '1900-01-01');
    const to = warehouseDate(q.expiresTo, '9999-12-31');
    if (from > to)
      throw new BadRequestException('Khoảng hạn dùng không hợp lệ.');
    params.push(from, to);
    clauses.push(
      `EXISTS(SELECT 1 FROM stock_lots fl WHERE fl.stock_id="stockId" AND fl.product_id="productId" AND fl.quantity>0 AND fl.expires_at BETWEEN $${params.length - 1}::date AND $${params.length}::date)`,
    );
  }
  return {
    params,
    where: clauses.length
      ? clauses.map((sql) => `(${sql})`).join(' AND ')
      : 'true',
  };
}

// Match the product picker: global/foreign catalog entries only belong here
// once a stock record exists in this branch (including transferred products).
const inventoryProductScope = stockProductCondition('p').replaceAll(':branchId', '$1');

/** Each row is one product in one warehouse; all joins below are one-to-one. */
export const warehouseInventoryCte = `WITH inventory AS (
  SELECT COALESCE(si.id::text,s.id::text || ':' || p.id::text) AS id, s.id AS "stockId", s.name AS "stockName", p.id AS "productId", p.code, p.name,
    p.product_type AS "productType", p.category_id AS "categoryId", c.name AS "categoryName",
    COALESCE(u.code,NULLIF(p.unit,''),'Chưa có đơn vị') AS unit, COALESCE(si.quantity,0) AS quantity,
    NULL::numeric AS "reservedQuantity",
    COALESCE(l.expired,0) AS "expiredQuantity", COALESCE(l.expiring,0) AS "expiringQuantity",
    GREATEST(0,COALESCE(si.quantity,0)-COALESCE(l.expired,0)) AS "availableQuantity",
    p.minimum_stock AS "minimumStock", p.cost_price AS "costPrice",
    CASE WHEN p.cost_price IS NOT NULL THEN COALESCE(si.quantity,0)*p.cost_price END AS "inventoryValue",
    l.nearest_expiry AS "nearestExpiry", p.lot_tracking_enabled AS "lotTrackingEnabled", p.is_active AS "isActive"
  FROM stocks s JOIN products p ON ${inventoryProductScope}
  LEFT JOIN stock_items si ON si.stock_id=s.id AND si.product_id=p.id
  LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN measurement_units u ON u.id=p.base_unit_id
  LEFT JOIN LATERAL (
    SELECT SUM(quantity) FILTER(WHERE expires_at < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS expired,
      SUM(quantity) FILTER(WHERE expires_at BETWEEN (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+7) AS expiring,
      MIN(expires_at) FILTER(WHERE quantity>0) AS nearest_expiry
    FROM stock_lots WHERE stock_id=s.id AND product_id=p.id
  ) l ON true WHERE s.branch_id=$1 AND (p.is_active OR COALESCE(si.quantity,0)<>0)
)`;
