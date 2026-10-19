import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  warehouseFilters,
  warehouseInventoryCte,
  warehouseRange,
} from './warehouse-query';

@Injectable()
export class WarehouseService {
  constructor(private readonly db: DataSource) {}
  private paging(q: any) {
    const page = Math.min(
      1000000,
      Math.max(1, Math.floor(Number(q.page) || 1)),
    );
    const size = Math.min(100, Math.max(1, Math.floor(Number(q.size) || 20)));
    return { page, size, offset: (page - 1) * size };
  }
  stocks(branchId: string) {
    return this.db.query(
      'SELECT id,name FROM stocks WHERE branch_id=$1 ORDER BY name,id',
      [branchId],
    );
  }
  async inventory(branchId: string, q: any) {
    const { page, size, offset } = this.paging(q);
    const { params, where } = warehouseFilters(q, branchId);
    const [result] = await this.db.query(
      `${warehouseInventoryCte}, filtered AS (SELECT * FROM inventory WHERE ${where}),
      paged AS (SELECT * FROM filtered ORDER BY name,"stockName",id LIMIT $${params.length + 1} OFFSET $${params.length + 2})
      SELECT (SELECT COUNT(*)::int FROM filtered) AS total,
      COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY name,"stockName",id),'[]'::jsonb) AS data FROM paged`,
      [...params, size, offset],
    );
    return { ...result, page, size, reservationsSupported: false };
  }
  async detail(branchId: string, productId: string, q: any) {
    const { page, size, offset } = this.paging(q);
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      const warehouses = await manager.query(
        `${warehouseInventoryCte} SELECT * FROM inventory WHERE "productId"=$2 ORDER BY "stockName",id`,
        [branchId, productId],
      );
      if (!warehouses.length)
        throw new NotFoundException(
          'Không tìm thấy tồn kho của hàng hóa trong chi nhánh.',
        );
      const lots = await manager.query(
        `SELECT l.*, l.lot_code AS "lotCode",l.manufactured_at AS "manufacturedAt",l.expires_at AS "expiresAt",s.name AS "stockName"
        FROM stock_lots l JOIN stocks s ON s.id=l.stock_id WHERE s.branch_id=$1 AND l.product_id=$2 ORDER BY l.expires_at ASC NULLS LAST,l.id`,
        [branchId, productId],
      );
      const [movements] = await manager.query(
        `WITH history AS (
        SELECT m.id,m.created_at AS "createdAt",m.quantity,m.lot_id AS "lotId",l.lot_code AS "lotCode",s.name AS "stockName",m.reference_id AS "referenceId",
          COALESCE(i.code,e.code,t.code,k.code) AS "referenceCode",
          CASE WHEN k.id IS NOT NULL THEN 'ADJUSTMENT' WHEN i.id IS NOT NULL THEN 'IMPORT'
            WHEN e.id IS NOT NULL THEN 'EXPORT' WHEN t.id IS NOT NULL THEN 'TRANSFER'
            WHEN b.id IS NOT NULL THEN 'PRODUCTION' ELSE 'OTHER' END AS "referenceType"
        FROM stock_movements m JOIN stocks s ON s.id=m.stock_id LEFT JOIN stock_lots l ON l.id=m.lot_id
        LEFT JOIN stock_receipt_import i ON i.id=m.reference_id LEFT JOIN stock_receipt_export e ON e.id=m.reference_id
        LEFT JOIN stock_receipt_transfer t ON t.id=m.reference_id LEFT JOIN stock_takes k ON k.id=m.reference_id
        LEFT JOIN kitchen_production_batches b ON b.id=m.reference_id
        WHERE s.branch_id=$1 AND m.product_id=$2),
        filtered AS (SELECT * FROM history WHERE NOT $5::boolean OR "referenceType"='ADJUSTMENT'),
        paged AS (SELECT * FROM filtered ORDER BY "createdAt" DESC,id LIMIT $3 OFFSET $4)
        SELECT (SELECT COUNT(*)::int FROM filtered) AS total,COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY "createdAt" DESC,id),'[]') AS data FROM paged`,
        [branchId, productId, size, offset, q.historyKind === 'ADJUSTMENT'],
      );
      return {
        product: warehouses[0],
        warehouses,
        lots,
        movements: { ...movements, page, size },
        reservationsSupported: false,
      };
    });
  }
  async overview(branchId: string, q: any) {
    const { from, to } = warehouseRange(q);
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      const [
        summaryRows,
        quantityByUnit,
        lotRows,
        pendingRows,
        movementTrend,
        valueHistory,
        categoryShare,
        consumption,
        expiringLots,
        expiryDistribution,
        coverage,
      ] = await Promise.all([
        manager.query(
          `${warehouseInventoryCte} SELECT
          COUNT(DISTINCT "productId")::int AS "totalProducts",
          COALESCE(SUM("inventoryValue"),0) AS "inventoryValue",
          COUNT(*) FILTER(WHERE "costPrice" IS NULL AND quantity<>0)::int AS "missingCostRows",
          COUNT(DISTINCT "productId") FILTER(WHERE "minimumStock" IS NOT NULL AND quantity<"minimumStock")::int AS "lowStockProducts",
          COUNT(DISTINCT "productId") FILTER(WHERE "minimumStock" IS NOT NULL)::int AS "configuredMinimumProducts"
          FROM inventory`,
          [branchId],
        ),
        manager.query(
          `${warehouseInventoryCte} SELECT unit,SUM(quantity) AS quantity FROM inventory GROUP BY unit ORDER BY unit`,
          [branchId],
        ),
        manager.query(
          `SELECT COUNT(*) FILTER(WHERE quantity>0 AND (expires_at IS NULL OR expires_at >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))::int AS "activeLots",
          COUNT(*) FILTER(WHERE quantity>0 AND expires_at BETWEEN (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+7)::int AS "expiringLots",
          COUNT(*) FILTER(WHERE quantity>0 AND expires_at < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::int AS "expiredLots"
          FROM stock_lots l JOIN stocks s ON s.id=l.stock_id WHERE s.branch_id=$1`,
          [branchId],
        ),
        manager.query(
          `SELECT (SELECT COUNT(*)::int FROM stock_receipt_import WHERE branch_id=$1 AND status='DRAFT') AS "pendingImports",
          (SELECT COUNT(*)::int FROM stock_receipt_export WHERE branch_id=$1 AND status='DRAFT') AS "pendingExports"`,
          [branchId],
        ),
        manager.query(
          `SELECT (m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day,COALESCE(u.code,NULLIF(p.unit,''),'Chưa có đơn vị') AS unit,
          SUM(GREATEST(m.quantity,0)) AS incoming,SUM(GREATEST(-m.quantity,0)) AS outgoing
          FROM stock_movements m JOIN stocks s ON s.id=m.stock_id JOIN products p ON p.id=m.product_id LEFT JOIN measurement_units u ON u.id=p.base_unit_id
          WHERE s.branch_id=$1 AND m.created_at >= $2::date AT TIME ZONE 'Asia/Ho_Chi_Minh' AND m.created_at < ($3::date+1) AT TIME ZONE 'Asia/Ho_Chi_Minh'
          GROUP BY 1,2 ORDER BY day,unit`,
          [branchId, from, to],
        ),
        // Reconstruct quantities from today's balance and later ledger deltas. Cost basis is today's product cost, not historical FIFO.
        manager.query(
          `WITH days AS (SELECT generate_series($2::date,$3::date,'1 day'::interval)::date AS day),
          daily AS (SELECT (m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,SUM(m.quantity*COALESCE(p.cost_price,0)) AS delta
            FROM stock_movements m JOIN stocks s ON s.id=m.stock_id JOIN products p ON p.id=m.product_id WHERE s.branch_id=$1 GROUP BY day),
          current_value AS (SELECT COALESCE(SUM(si.quantity*COALESCE(p.cost_price,0)),0) AS value FROM stock_items si JOIN stocks s ON s.id=si.stock_id JOIN products p ON p.id=si.product_id WHERE s.branch_id=$1),
          coverage AS (SELECT MIN((m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS first_day FROM stock_movements m JOIN stocks s ON s.id=m.stock_id WHERE s.branch_id=$1)
          SELECT d.day::text AS day,CASE WHEN d.day>=coverage.first_day THEN current_value.value-COALESCE((SELECT SUM(delta) FROM daily WHERE day>d.day),0) END AS value
          FROM days d CROSS JOIN current_value CROSS JOIN coverage ORDER BY d.day`,
          [branchId, from, to],
        ),
        manager.query(
          `${warehouseInventoryCte} SELECT COALESCE("categoryName",'Chưa phân nhóm') AS name,COALESCE(SUM("inventoryValue"),0) AS value FROM inventory GROUP BY "categoryId","categoryName" HAVING SUM("inventoryValue")>0 ORDER BY value DESC`,
          [branchId],
        ),
        manager.query(
          `SELECT p.id AS "productId",p.name,COALESCE(u.code,NULLIF(p.unit,''),'Chưa có đơn vị') AS unit,SUM(-m.quantity) AS quantity
          FROM stock_movements m JOIN stocks s ON s.id=m.stock_id JOIN products p ON p.id=m.product_id LEFT JOIN measurement_units u ON u.id=p.base_unit_id
          LEFT JOIN kitchen_production_batches b ON b.id=m.reference_id LEFT JOIN stock_receipt_export e ON e.id=m.reference_id
          WHERE s.branch_id=$1 AND m.quantity<0 AND p.product_type='INGREDIENT'
          AND (b.id IS NOT NULL OR e.reference_type='kitchen_consumption_session')
          AND m.created_at >= $2::date AT TIME ZONE 'Asia/Ho_Chi_Minh' AND m.created_at < ($3::date+1) AT TIME ZONE 'Asia/Ho_Chi_Minh'
          GROUP BY p.id,p.name,u.code,p.unit ORDER BY quantity DESC,p.id`,
          [branchId, from, to],
        ),
        manager.query(
          `SELECT l.id,l.lot_code AS "lotCode",p.name,l.quantity,COALESCE(u.code,NULLIF(p.unit,''),'') AS unit,l.expires_at::text AS "expiresAt",s.name AS "stockName"
          FROM stock_lots l JOIN stocks s ON s.id=l.stock_id JOIN products p ON p.id=l.product_id LEFT JOIN measurement_units u ON u.id=p.base_unit_id
          WHERE s.branch_id=$1 AND l.quantity>0 AND l.expires_at<=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+7 ORDER BY l.expires_at,l.id LIMIT 12`,
          [branchId],
        ),
        manager.query(
          `SELECT l.expires_at::text AS day,COUNT(*)::int AS lots FROM stock_lots l JOIN stocks s ON s.id=l.stock_id
          WHERE s.branch_id=$1 AND l.quantity>0 AND l.expires_at BETWEEN (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+7 GROUP BY l.expires_at ORDER BY l.expires_at`,
          [branchId],
        ),
        manager.query(
          `SELECT MIN((m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::text AS "firstMovementAt" FROM stock_movements m JOIN stocks s ON s.id=m.stock_id WHERE s.branch_id=$1`,
          [branchId],
        ),
      ]);
      return {
        generatedAt: new Date().toISOString(),
        from,
        to,
        summary: { ...summaryRows[0], ...lotRows[0], ...pendingRows[0] },
        quantityByUnit,
        movementTrend,
        valueHistory,
        categoryShare,
        consumption,
        expiringLots,
        expiryDistribution,
        coverage: coverage[0],
        reservationsSupported: false,
        valuationBasis: 'CURRENT_PRODUCT_COST',
        expiryWarningDays: 7,
      };
    });
  }
}
