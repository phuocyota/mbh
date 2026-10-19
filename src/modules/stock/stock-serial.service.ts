import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isUUID } from 'class-validator';

// Imported serial identities are receipt detail + ordinal. There is no ledger
// assigning individual serials to exports/transfers, so no current-stock status.
export const stockSerialCte = `WITH serials AS (
  SELECT d.id AS "detailId", x.position::int AS position, x.serial,
    p.id AS "productId",p.code AS "productCode",p.name AS "productName",
    r.id AS "receiptId",r.code AS "receiptCode",r.created_at AS "receivedAt",
    d.input_details->>'purchasedAt' AS "purchasedAt",
    r.status AS "receiptStatus",d.input_details->>'serialMode' AS "serialMode",
    d.input_details->>'lotCode' AS "lotCode",location."lotId",
    location."stockId",location."stockName",supplier.name AS "supplierName",
    supplier.id AS "supplierId",d.input_details->>'manufacturedAt' AS "manufacturedAt",
    d.input_details->>'expiresAt' AS "expiresAt"
  FROM stock_receipt_detail d
  JOIN stock_receipt_import r ON r.id=d.import_id AND r.branch_id=$1
  JOIN products p ON p.id=d.product_id
  CROSS JOIN LATERAL jsonb_array_elements_text(CASE
    WHEN jsonb_typeof(d.input_details->'serials')='array' THEN d.input_details->'serials'
    ELSE '[]'::jsonb END) WITH ORDINALITY x(serial,position)
  LEFT JOIN suppliers supplier ON r.from_type='SUPPLIER' AND supplier.id=r.from_id
    AND (supplier.branch_id IS NULL OR supplier.branch_id=r.branch_id)
  LEFT JOIN LATERAL (
    SELECT s.id AS "stockId",s.name AS "stockName",l.id AS "lotId"
    FROM stock_movements m JOIN stocks s ON s.id=m.stock_id AND s.branch_id=r.branch_id
    LEFT JOIN stock_lots l ON l.id=m.lot_id AND l.product_id=d.product_id AND l.stock_id=s.id
    WHERE m.reference_id=r.id AND m.product_id=d.product_id AND m.quantity>0
    ORDER BY m.created_at,m.id LIMIT 1
  ) location ON true
  WHERE d.receipt_type='IMPORT' AND btrim(x.serial)<>''
)`;

@Injectable()
export class StockSerialService {
  constructor(private readonly db: DataSource) {}
  async list(branchId: string, q: any) {
    const params: any[] = [branchId];
    const clauses: string[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      clauses.push(sql.replaceAll('?', `$${params.length}`));
    };
    for (const key of ['search', 'lotCode', 'serial']) {
      if (q[key] !== undefined && typeof q[key] !== 'string')
        throw new BadRequestException('Bộ lọc serial không hợp lệ.');
    }
    if (q.serial !== undefined) {
      if (!q.serial.trim() || q.serial.trim().length > 128)
        throw new BadRequestException('Số serial không hợp lệ.');
      add('serial=?', q.serial.trim());
    }
    if (q.search?.trim())
      add(
        '(serial ILIKE ? OR "productCode" ILIKE ? OR "productName" ILIKE ? OR "receiptCode" ILIKE ? OR "lotCode" ILIKE ?)',
        `%${q.search.trim()}%`,
      );
    if (q.lotCode?.trim()) add('"lotCode" ILIKE ?', `%${q.lotCode.trim()}%`);
    for (const key of ['stockId', 'productId', 'lotId', 'detailId']) {
      if (q[key]) {
        if (!isUUID(q[key]))
          throw new BadRequestException('Mã lọc serial không hợp lệ.');
        add(`"${key}"=?::uuid`, q[key]);
      }
    }
    for (const [key, allowed] of [
      ['serialMode', ['MANUAL', 'AUTO']],
      ['receiptStatus', ['COMPLETED', 'CANCELLED', 'DRAFT']],
    ] as const) {
      if (q[key]) {
        if (!(allowed as readonly string[]).includes(q[key]))
          throw new BadRequestException('Trạng thái serial không hợp lệ.');
        add(`"${key}"=?`, q[key]);
      }
    }
    if (q.position !== undefined) {
      const n = Number(q.position);
      if (!Number.isSafeInteger(n) || n < 1 || n > 10000)
        throw new BadRequestException('Vị trí serial không hợp lệ.');
      add('position=?', n);
    }
    const page = Math.min(
      1000000,
      Math.max(1, Math.floor(Number(q.page) || 1)),
    );
    const size = Math.min(100, Math.max(1, Math.floor(Number(q.size) || 20)));
    const [result] = await this.db.query(
      `${stockSerialCte}, filtered AS (SELECT * FROM serials WHERE ${clauses.join(' AND ') || 'true'}),
      paged AS (SELECT * FROM filtered ORDER BY "receivedAt" DESC,"detailId",position LIMIT $${params.length + 1} OFFSET $${params.length + 2})
      SELECT (SELECT COUNT(*)::int FROM filtered) AS total,
      COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY "receivedAt" DESC,"detailId",position),'[]'::jsonb) AS data FROM paged`,
      [...params, size, (page - 1) * size],
    );
    return { ...result, page, size, serialMovementTrackingSupported: false };
  }
  async detail(branchId: string, detailId: string, position: number) {
    const result = await this.list(branchId, { detailId, position, size: 1 });
    if (!result.data.length)
      throw new NotFoundException('Không tìm thấy serial trong chi nhánh.');
    return { ...result.data[0], serialMovementTrackingSupported: false };
  }
}
