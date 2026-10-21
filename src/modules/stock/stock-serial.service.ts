import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { StockReceiptDetail } from '../../entities';
import { RegisterLotSerialsDto } from './dto/register-lot-serials.dto';
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
  // Retain receipt-detail + ordinal identities used by existing lookup/QR APIs.
  // Registering serials is metadata-only: no stock movement or quantity update.
  async registration(branchId: string, lotId: string, manager?: EntityManager) {
    const db = manager || this.db;
    const [lot] = await db.query(
      `SELECT l.id,l.lot_code AS "lotCode",l.product_id AS "productId",l.quantity,
         p.name AS "productName",COALESCE(u.code,p.unit) AS unit
       FROM stock_lots l JOIN stocks s ON s.id=l.stock_id
       JOIN products p ON p.id=l.product_id
       LEFT JOIN measurement_units u ON u.id=p.base_unit_id
       WHERE l.id=$1 AND s.branch_id=$2`, [lotId, branchId],
    );
    if (!lot) throw new NotFoundException('Không tìm thấy lô trong chi nhánh.');
    const receipts = await db.query(
      `SELECT d.id AS "detailId",r.code AS "receiptCode",d.quantity,
         d.input_details AS "inputDetails"
       FROM stock_receipt_detail d
       JOIN stock_receipt_import r ON r.id=d.import_id AND r.branch_id=$2
       WHERE d.product_id=$3 AND d.receipt_type='IMPORT' AND r.status='COMPLETED'
         AND d.input_details->>'lotCode'=$4
         AND EXISTS (SELECT 1 FROM stock_movements m
           WHERE m.reference_id=r.id AND m.product_id=d.product_id AND m.lot_id=$1 AND m.quantity>0)
         AND (SELECT COUNT(*) FROM stock_receipt_detail x
           WHERE x.import_id=r.id AND x.product_id=d.product_id AND x.receipt_type='IMPORT')=1
         AND d.quantity=(SELECT SUM(m.quantity) FROM stock_movements m
           WHERE m.reference_id=r.id AND m.product_id=d.product_id AND m.lot_id=$1 AND m.quantity>0)
       ORDER BY r.created_at,d.id`, [lotId, branchId, lot.productId, lot.lotCode],
    );
    return { lot, receipts: receipts.map((r) => {
      const quantity = Number(r.quantity);
      const serials = Array.isArray(r.inputDetails?.serials) ? r.inputDetails.serials : [];
      return { detailId: r.detailId, receiptCode: r.receiptCode, quantity, serials,
        remaining: Math.max(0, quantity - serials.length),
        canRegister: Number.isInteger(quantity) && quantity > 0 && quantity <= 10000 && serials.length < quantity,
      };
    }) };
  }

  async register(branchId: string, lotId: string, dto: RegisterLotSerialsDto, actorId: string) {
    if (!isUUID(dto.detailId) || !Array.isArray(dto.serials) || !dto.serials.length || dto.serials.length > 10000 ||
        dto.serials.some((s) => typeof s !== 'string' || !s.trim() || s.trim().length > 128))
      throw new BadRequestException('Mỗi serial phải có từ 1 đến 128 ký tự, tối đa 10.000 serial.');
    const serials = dto.serials.map((s) => s.trim());
    if (new Set(serials).size !== serials.length)
      throw new BadRequestException('Serial không được trùng nhau.');
    return this.db.transaction(async (manager) => {
      // Same lock as intake serial registration: prevents duplicate identities
      // across concurrent receipts and post-intake registration in this branch.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['stock-branch:' + branchId]);
      const context = await this.registration(branchId, lotId, manager);
      const receipt = context.receipts.find((r) => r.detailId === dto.detailId);
      if (!receipt) throw new BadRequestException('Phiếu nhập không thuộc lô hoặc chưa đủ căn cứ để gán serial.');
      if (!Number.isInteger(receipt.quantity) || receipt.quantity < 1 || receipt.quantity > 10000 || serials.length > receipt.quantity)
        throw new BadRequestException('Số serial không được vượt số lượng nhập nguyên đơn vị (tối đa 10.000).');
      if (receipt.serials.some((s, i) => serials[i] !== s))
        throw new ConflictException('Serial đã lưu không được sửa hoặc xóa. Hãy tải lại và bổ sung serial mới.');
      const duplicates = await manager.query(
        `SELECT 1 FROM stock_receipt_detail d JOIN stock_receipt_import r ON r.id=d.import_id
         WHERE r.branch_id=$1 AND d.product_id=$2 AND d.id<>$3
           AND (d.input_details->'serials') ?| $4::text[] LIMIT 1`,
        [branchId, context.lot.productId, dto.detailId, serials],
      );
      if (duplicates.length) throw new ConflictException('Serial đã được khai báo cho hàng hóa này trong chi nhánh.');
      if (serials.length !== receipt.serials.length) {
        const detail = await manager.getRepository(StockReceiptDetail).findOneByOrFail({ id: dto.detailId });
        await manager.update(StockReceiptDetail, detail.id, {
          inputDetails: { ...detail.inputDetails, serialMode: 'MANUAL', serials,
            serialRegisteredAt: new Date().toISOString(), serialRegisteredBy: actorId },
          updatedBy: actorId,
        });
      }
      return this.registration(branchId, lotId, manager);
    });
  }

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
