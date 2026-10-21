import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { isUUID } from 'class-validator';
import {
  KitchenOperation,
  KitchenMealPlan,
  KitchenProductionBatch,
  KitchenOrderTicket,
  KitchenRecipe,
  Product,
  StockLot,
  Stock,
  Order,
  OrderStatusLog,
  MeasurementUnit,
  User,
} from '../../entities';
import { KitchenOperationsService } from './kitchen-operations.service';
import {
  StockMovementService,
  localDate,
} from '../stock/stock-movement.service';
import { resolveStockBranch } from '../stock/stock-scope';
import { calculateRecipeRequirement } from './kitchen.rules';
import {
  assertTaskAction,
  taskNumber,
  validateTaskActuals,
} from './kitchen-task.rules';
import { requestFingerprint } from '../../common/utils/request-fingerprint';
import {
  planTaskRound,
  remainingTaskSnapshot,
  selectTaskRound,
} from './kitchen-task-planning';
import {
  ORDER_STATUS,
  ORDER_PAYMENT_STATUS,
} from '../../common/constant/constant';

@Injectable()
export class KitchenTaskService {
  constructor(
    private db: DataSource,
    private operations: KitchenOperationsService,
    private movements: StockMovementService,
  ) {}
  private async source(m: EntityManager, actor: any, type: string, id: string) {
    if (!isUUID(id) || !['batch', 'ticket'].includes(type))
      throw new BadRequestException('Nhiệm vụ không hợp lệ.');
    const row: any =
      type === 'batch'
        ? await m
            .getRepository(KitchenProductionBatch)
            .findOne({ where: { id }, relations: ['mealPlan'] })
        : await m
            .getRepository(KitchenOrderTicket)
            .findOne({ where: { id }, relations: ['items', 'order'] });
    if (!row) throw new NotFoundException('Không tìm thấy nhiệm vụ.');
    const branchId = resolveStockBranch(
      actor,
      type === 'batch' ? row.mealPlan.branchId : row.branchId,
    );
    if (type === 'batch' && row.details?.workflowTicketId)
      throw new BadRequestException(
        'Mẻ này thuộc đơn căn tin. Hãy mở nhiệm vụ của đơn.',
      );
    if (
      type === 'ticket' &&
      (row.order?.paymentStatus !== ORDER_PAYMENT_STATUS.PAID ||
        Number(row.order?.status) === ORDER_STATUS.CANCELLED)
    )
      throw new ConflictException('Đơn chưa thanh toán hoặc đã hủy.');
    return {
      row,
      branchId,
      date:
        type === 'batch'
          ? row.mealPlan.planDate
          : localDate(new Date(row.createdAt)),
      shift: type === 'batch' ? row.shift : 'Ca trưa',
    };
  }
  async list(actor: any, q: any) {
    const branchId = resolveStockBranch(actor, q.branchId),
      date = q.date || localDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new BadRequestException('Ngày không hợp lệ.');
    const rows = await this.db.query(
      `
      SELECT b.id, 'batch' AS type, p.name AS name, b.status AS "sourceStatus", b.planned_quantity+b.adjustment_quantity AS quantity, b.details->>'deadline' AS deadline,
        f.status AS "flowStatus", f.payload->>'ownerName' AS "ownerName"
      FROM kitchen_production_batches b JOIN kitchen_meal_plans mp ON mp.id=b.meal_plan_id JOIN products p ON p.id=b.product_id
      LEFT JOIN kitchen_operations f ON f.parent_id=b.id AND f.branch_id=mp.branch_id AND f.kind='task-flow'
      WHERE mp.branch_id=$1 AND mp.plan_date=$2 AND NOT (b.details ? 'workflowTicketId')
      UNION ALL
      SELECT t.id, 'ticket', COALESCE('Đơn '||o.order_number::text,o.order_code), t.status,
        (SELECT SUM(i.quantity) FROM kitchen_order_ticket_items i WHERE i.ticket_id=t.id), NULL, f.status, f.payload->>'ownerName'
      FROM kitchen_order_tickets t JOIN orders o ON o.id=t.order_id
      LEFT JOIN kitchen_operations f ON f.parent_id=t.id AND f.branch_id=t.branch_id AND f.kind='task-flow'
      WHERE t.branch_id=$1 AND CAST(t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS date)=$2::date AND o.payment_status='PAID' AND o.status<>0 AND (f.id IS NOT NULL OR EXISTS(SELECT 1 FROM kitchen_order_ticket_items ti JOIN products tp ON tp.id=ti.product_id WHERE ti.ticket_id=t.id AND tp.product_type='FINISHED_GOOD'))
    `,
      [branchId, date],
    );
    return rows
      .filter((row) => !q.type || row.type === q.type)
      .map((row) => ({
        ...row,
        status:
          row.flowStatus ||
          (row.sourceStatus === 'WAITING' ? 'WAITING' : 'LEGACY'),
        quantity: Number(row.quantity),
      }));
  }
  private async requirements(m: EntityManager, source: any, type: string) {
    const sourceItems =
      type === 'batch'
        ? [
            {
              productId: source.row.productId,
              quantity:
                Number(source.row.plannedQuantity) +
                Number(source.row.adjustmentQuantity),
            },
          ]
        : source.row.items;
    const grouped = new Map<string, any>();
    for (const item of sourceItems)
      grouped.set(item.productId, {
        ...item,
        quantity:
          Number(item.quantity) +
          Number(grouped.get(item.productId)?.quantity || 0),
      });
    const items = [...grouped.values()];
    const dishes = [] as any[],
      missingRecipes = [] as string[];
    for (const item of items) {
      const product = await m
        .getRepository(Product)
        .findOneByOrFail({ id: item.productId });
      if (product.productType !== 'FINISHED_GOOD') continue;
      const recipe = await m.getRepository(KitchenRecipe).findOne({
        where: {
          branchId: source.branchId,
          productId: product.id,
          status: 'ACTIVE',
        },
        relations: [
          'items',
          'items.unit',
          'items.ingredientProduct',
          'yieldUnit',
        ],
      });
      if (!recipe || !recipe.items.length) {
        missingRecipes.push(product.name);
        continue;
      }
      const requirements = [] as any[];
      for (const line of recipe.items) {
        const unit = line.ingredientProduct.baseUnitId
          ? await m
              .getRepository(MeasurementUnit)
              .findOneBy({ id: line.ingredientProduct.baseUnitId })
          : null;
        if (!unit)
          throw new BadRequestException(
            'Nguyên liệu chưa có đơn vị tồn chuẩn.',
          );
        requirements.push({
          productId: line.ingredientProductId,
          name: line.ingredientProduct.name,
          unit: unit.code,
          unitId: unit.id,
          quantity: calculateRecipeRequirement(
            Number(line.quantity),
            line.unit,
            unit,
            Number(item.quantity),
            Number(recipe.yieldQuantity),
          ),
        });
      }
      dishes.push({
        productId: product.id,
        name: product.name,
        quantity: Number(item.quantity),
        requiresSample: product.requiresSample,
        recipeId: recipe.id,
        recipeVersion: recipe.version,
        description: recipe.description,
        requirements,
      });
    }
    return { dishes, missingRecipes };
  }
  private async migrationCheck(m: EntityManager, source: any, type: string) {
    if (source.date !== localDate())
      return {
        allowed: false,
        reason: 'Chỉ tiếp nhận nhiệm vụ chế biến trong ngày hôm nay.',
      };
    if (
      source.row.status !== 'PREPARING' ||
      (type === 'ticket' &&
        Number(source.row.order.status) !== ORDER_STATUS.PREPARING)
    )
      return {
        allowed: false,
        reason:
          'Nhiệm vụ đã sẵn sàng, bàn giao hoặc kết thúc; cần đối chiếu thành phẩm đã tạo.',
      };
    if (
      type === 'batch' &&
      (source.row.details?.traceabilityVersion ||
        source.row.details?.inputLots?.length ||
        source.row.actualQuantity != null)
    )
      return {
        allowed: false,
        reason:
          'Mẻ đã có hồ sơ nguyên liệu hoặc sản lượng thực tế; cần đối chiếu trước khi tiếp nhận.',
      };
    const ids = [
      source.row.id,
      ...(type === 'ticket' ? [source.row.orderId] : []),
    ];
    const [evidence] = await m.query(
      `SELECT
        EXISTS(SELECT 1 FROM stock_movements WHERE reference_id=ANY($1::uuid[])) AS movements,
        EXISTS(SELECT 1 FROM stock_receipt_export e WHERE e.branch_id=$2 AND e.reference_id=ANY($1::uuid[]) AND e.status<>'CANCELLED'
          AND (COALESCE(e.reference_type,'')<>'order'
            OR NOT EXISTS(SELECT 1 FROM stock_receipt_detail d WHERE d.export_id=e.id AND d.receipt_type='EXPORT')
            OR EXISTS(SELECT 1 FROM stock_receipt_detail d LEFT JOIN products p ON p.id=d.product_id
              WHERE d.export_id=e.id AND d.receipt_type='EXPORT' AND (p.product_type IN ('INGREDIENT','FUEL') OR p.product_type IS NULL)))) AS exports,
        EXISTS(SELECT 1 FROM kitchen_production_batches b JOIN kitchen_meal_plans p ON p.id=b.meal_plan_id
          WHERE p.branch_id=$2 AND b.id<>$3 AND (b.details->>'workflowTicketId'=$3::text OR b.details->>'workflowTaskId'=$3::text
            OR b.details->>'ticketId'=$3::text OR b.details->>'orderId'=$4::text)) AS batches,
        EXISTS(SELECT 1 FROM kitchen_operations WHERE branch_id=$2 AND kind<>'task-flow' AND
          (parent_id=ANY($1::uuid[]) OR payload->>'batchId'=$3::text OR payload->>'ticketId'=$3::text OR payload->>'orderId'=$4::text)) AS documents,
        EXISTS(SELECT 1 FROM kitchen_consumption_sessions WHERE branch_id=$2 AND session_date=$5::date
          AND meal_period=$6 AND status='CONFIRMED' AND ($7::uuid IS NULL OR station_id=$7::uuid)) AS sessions`,
      [
        ids,
        source.branchId,
        source.row.id,
        type === 'ticket' ? source.row.orderId : null,
        source.date,
        type === 'batch' ? source.row.mealPlan.mealPeriod : 'LUNCH',
        source.row.stationId || null,
      ],
    );
    if (Object.values(evidence).some(Boolean))
      return {
        allowed: false,
        reason:
          'Đã có giao dịch kho, mẻ liên quan hoặc xác nhận tiêu hao. Cần đối chiếu chứng từ để tránh xuất nguyên liệu hai lần.',
      };
    return { allowed: true, reason: '' };
  }
  private async detail(m: EntityManager, actor: any, type: string, id: string) {
    const source = await this.source(m, actor, type, id);
    const flow = await m.getRepository(KitchenOperation).findOneBy({
      kind: 'task-flow',
      parentId: id,
      branchId: source.branchId,
    });
    const snapshot =
      flow?.payload.snapshot || (await this.requirements(m, source, type));
    const status =
      flow?.status || (source.row.status === 'WAITING' ? 'WAITING' : 'LEGACY');
    const pendingHandover =
      status === 'WAITING' &&
      (flow?.payload.rounds || []).some((round: any) => !round.handover);
    const handoverSuggestions =
      status === 'COMPLETED' || pendingHandover
        ? await this.handoverSuggestions(m, actor, source, type)
        : null;
    const productIds = [
      ...new Set(
        snapshot.dishes.flatMap((dish) =>
          dish.requirements.map((line) => line.productId),
        ),
      ),
    ] as string[];
    const lots = productIds.length
      ? await m.query(
          `SELECT l.id,l.product_id AS "productId",l.lot_code AS "lotCode",
            GREATEST(0, LEAST(l.quantity, COALESCE(si.quantity,0) - COALESCE(SUM(l.quantity) OVER (
              PARTITION BY l.stock_id,l.product_id ORDER BY l.expires_at ASC NULLS LAST,l.created_at,l.id
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0))) AS quantity,
            l.expires_at AS "expiresAt",s.name AS "stockName"
           FROM stock_lots l JOIN stocks s ON s.id=l.stock_id
           LEFT JOIN stock_items si ON si.stock_id=l.stock_id AND si.product_id=l.product_id
           WHERE s.branch_id=$1 AND l.product_id=ANY($2::uuid[]) AND l.quantity>0 AND (l.expires_at IS NULL OR l.expires_at >= $3::date)
           ORDER BY l.expires_at ASC NULLS LAST,l.created_at,l.id`,
          [source.branchId, productIds, localDate()],
        )
      : [];
    return {
      id,
      type,
      branchId: source.branchId,
      date: source.date,
      shift: source.shift,
      sourceStatus: source.row.status,
      deadline: source.row.details?.deadline || null,
      name:
        type === 'ticket'
          ? `Đơn ${source.row.order?.orderNumber || source.row.orderId}`
          : snapshot.dishes[0]?.name || 'Mẻ chế biến',
      status,
      migration:
        status === 'LEGACY' && !flow
          ? await this.migrationCheck(m, source, type)
          : null,
      version: flow?.version || 0,
      ...snapshot,
      lots: lots.filter((lot: any) => Number(lot.quantity) > 0),
      suggestedRound: type === 'ticket' ? planTaskRound(snapshot, lots) : [],
      waitingForStock: Boolean(flow?.payload.waitingForStock),
      progress: (flow?.payload.originalSnapshot || snapshot).dishes.map(
        (dish: any) => {
          const rounds = flow?.payload.rounds || [];
          const completed = rounds.reduce(
            (sum: number, round: any) =>
              sum +
              Number(
                round.snapshot.dishes.find(
                  (row: any) => row.productId === dish.productId,
                )?.quantity || 0,
              ),
            0,
          );
          const current = ['COMPLETED', 'HANDED_OVER'].includes(
            flow?.status || '',
          )
            ? Number(
                snapshot.dishes.find(
                  (row: any) => row.productId === dish.productId,
                )?.quantity || 0,
              )
            : 0;
          return {
            productId: dish.productId,
            name: dish.name,
            quantity: dish.quantity,
            completedQuantity: completed + current,
            remainingQuantity: Math.max(0, dish.quantity - completed - current),
          };
        },
      ),
      history: flow?.payload.history || [],
      received: flow?.payload.received || [],
      actuals: flow?.payload.actuals || [],
      ownerId: flow?.payload.ownerId,
      ownerName: flow?.payload.ownerName,
      handover: flow?.payload.handover,
      handoverSuggestions,
      partialHandovers: flow?.payload.partialHandovers || [],
      pendingHandover: (flow?.status === 'WAITING'
        ? flow.payload.rounds || []
        : []
      )
        .filter((round: any) => !round.handover)
        .flatMap((round: any) =>
          round.actuals.map((actual: any) => ({
            batchId: actual.batchId,
            quantity: actual.quantity,
            name: round.received.find(
              (entry: any) => entry.batchId === actual.batchId,
            )?.name,
          })),
        ),
      items:
        type === 'ticket'
          ? source.row.items.map((item) => ({
              name: item.productName,
              quantity: item.quantity,
            }))
          : [],
      batchIds: flow?.payload.batchIds || [],
    };
  }
  async get(actor: any, type: string, id: string) {
    return this.detail(this.db.manager, actor, type, id);
  }
  private async handoverSuggestions(
    m: EntityManager,
    actor: any,
    source: any,
    type: string,
  ) {
    const staff = await m.query(
      `SELECT id, full_name AS name, role FROM users
       WHERE branch_id=$1 AND status='ACTIVE' AND id<>$2
         AND role IN ('CASHIER','STAFF','KITCHEN','HEAD_CHEF','MANAGER')
       ORDER BY CASE WHEN id=$3::uuid THEN 0 WHEN role='CASHIER' THEN 1 ELSE 2 END,full_name,id LIMIT 20`,
      [
        source.branchId,
        actor.userId,
        type === 'ticket' ? source.row.order?.cashierId || null : null,
      ],
    );
    const recent = await m.query(
      `SELECT payload->>'receivedBy' AS name, payload->>'receiverPlace' AS place
       FROM kitchen_operations WHERE branch_id=$1 AND kind='finished-exports' AND status='EXPORTED'
       ORDER BY created_at DESC,id DESC LIMIT 20`,
      [source.branchId],
    );
    const names = new Set<string>();
    const recipients = [
      ...staff.map((row: any) => ({
        name: row.name,
        role: row.role,
        source: 'STAFF',
      })),
      {
        name: type === 'ticket' ? 'Quầy căn tin' : 'Bộ phận chia suất',
        source: 'DEPARTMENT',
      },
      ...recent.map((row: any) => ({ name: row.name, source: 'RECENT' })),
    ]
      .filter((row) => {
        const name = String(row.name || '').trim();
        if (!name || name.length > 200 || names.has(name)) return false;
        row.name = name;
        names.add(name);
        return true;
      })
      .slice(0, 30);
    const defaultPlace =
      type === 'ticket' ? 'Quầy căn tin' : 'Khu chia suất bán trú';
    const places = [
      ...new Set([
        defaultPlace,
        ...recent.map((row: any) => String(row.place || '').trim()),
      ]),
    ]
      .filter((place: string) => place.length > 0 && place.length <= 200)
      .slice(0, 10);
    return { recipients, places, defaultPlace };
  }
  private scoped(m: EntityManager, afterCommit: Array<() => void>) {
    const operations = Object.create(this.operations);
    operations.db = {
      manager: m,
      transaction: (fn) => fn(m),
      getRepository: (entity) => m.getRepository(entity),
      query: (sql, args) => m.query(sql, args),
    };
    operations.taskFlowInternal = true;
    operations.socket = new Proxy((this.operations as any).socket, {
      get(target, key) {
        const value = Reflect.get(target, key);
        return typeof value === 'function'
          ? (...args: any[]) => {
              afterCommit.push(() => value.apply(target, args));
            }
          : value;
      },
    });
    return operations as KitchenOperationsService;
  }
  async action(actor: any, type: string, id: string, action: string, dto: any) {
    if (
      !isUUID(dto.requestId) ||
      !Number.isInteger(dto.expectedVersion) ||
      dto.expectedVersion < 0
    )
      throw new BadRequestException(
        'Thiếu mã yêu cầu hoặc phiên bản nhiệm vụ.',
      );
    const afterCommit: Array<() => void> = [];
    const result = await this.db.transaction(async (m) => {
      let source = await this.source(m, actor, type, id);
      await this.operations.lock(m, source.branchId);
      await m
        .getRepository(
          type === 'ticket' ? KitchenOrderTicket : KitchenProductionBatch,
        )
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (type === 'ticket')
        await m.getRepository(Order).findOne({
          where: { id: source.row.orderId },
          lock: { mode: 'pessimistic_write' },
        });
      source = await this.source(m, actor, type, id);
      const repo = m.getRepository(KitchenOperation);
      let flow = await repo.findOne({
        where: { kind: 'task-flow', parentId: id, branchId: source.branchId },
        lock: { mode: 'pessimistic_write' },
      });
      const fingerprint = requestFingerprint({ action, ...dto });
      if (flow?.payload.requests?.[dto.requestId]) {
        if (flow.payload.requests[dto.requestId] !== fingerprint)
          throw new ConflictException('Mã yêu cầu đã dùng cho nội dung khác.');
        return this.detail(m, actor, type, id);
      }
      const status =
        flow?.status ||
        (source.row.status === 'WAITING' ? 'WAITING' : 'LEGACY');
      if ((flow?.version || 0) !== dto.expectedVersion)
        throw new ConflictException('Nhiệm vụ vừa được cập nhật. Hãy làm mới.');
      assertTaskAction(status, action);
      if (
        source.date !== localDate() &&
        !['handover', 'handover-partial'].includes(action)
      )
        throw new ConflictException(
          'Chỉ thao tác chế biến cho nhiệm vụ trong ngày hôm nay.',
        );
      if (
        flow?.payload.ownerId &&
        flow.payload.ownerId !== actor.userId &&
        !['ADMIN', 'MANAGER', 'HEAD_CHEF'].includes(actor.userType)
      )
        throw new ConflictException(
          'Nhiệm vụ đang do nhân viên khác thực hiện.',
        );
      const ops = this.scoped(m, afterCommit);
      if (!flow)
        flow = repo.create({
          branchId: source.branchId,
          kind: 'task-flow',
          parentId: id,
          date: source.date,
          shift: source.shift,
          status: 'WAITING',
          requestId: null,
          payload: { history: [], requests: {} },
          createdBy: actor.userId,
        });
      if (action === 'migrate') {
        if (!['ADMIN', 'MANAGER', 'HEAD_CHEF'].includes(actor.userType))
          throw new ForbiddenException(
            'Bếp trưởng hoặc quản lý cần xác nhận tiếp nhận nhiệm vụ.',
          );
        if (dto.confirmUnissued !== true)
          throw new BadRequestException(
            'Cần xác nhận nguyên liệu chưa xuất và thành phẩm chưa được ghi nhận.',
          );
        if (flow.id)
          throw new ConflictException(
            'Nhiệm vụ đã có hồ sơ xử lý. Hãy làm mới.',
          );
        const check = await this.migrationCheck(m, source, type);
        if (!check.allowed) throw new ConflictException(check.reason);
        await this.operations.unlocked(
          m,
          source.branchId,
          source.date,
          source.shift,
        );
        flow.payload.migration = {
          previousStatus: source.row.status,
          previousStartedAt: source.row.startedAt,
          sourceVersion: source.row.version,
          confirmedBy: actor.userId,
          confirmedAt: new Date().toISOString(),
          confirmUnissued: true,
        };
        await m
          .getRepository(
            type === 'ticket' ? KitchenOrderTicket : KitchenProductionBatch,
          )
          .update(
            { id },
            { status: 'WAITING', startedAt: null, updatedBy: actor.userId },
          );
        flow.status = 'WAITING';
      }
      if (action === 'wait') {
        if (type !== 'ticket')
          throw new BadRequestException('Chỉ chia đợt cho đơn căn tin.');
        flow.payload.waitingForStock = true;
      }
      if (action === 'receive') {
        if (
          source.row.status !== 'WAITING' &&
          !(
            type === 'ticket' &&
            source.row.status === 'PREPARING' &&
            flow.payload.rounds?.length
          )
        )
          throw new ConflictException(
            'Nhiệm vụ đã bắt đầu ở luồng khác. Hãy làm mới.',
          );
        const outstanding = flow.payload.originalSnapshot
          ? remainingTaskSnapshot(
              flow.payload.originalSnapshot,
              flow.payload.rounds || [],
            )
          : await this.requirements(m, source, type);
        if (outstanding.missingRecipes.length)
          throw new BadRequestException(
            `Chưa có công thức đang áp dụng: ${outstanding.missingRecipes.join(', ')}.`,
          );
        if (!outstanding.dishes.length)
          throw new BadRequestException('Đơn không có món phải chế biến.');
        const snapshot = selectTaskRound(
          outstanding,
          dto.dishes,
          type === 'ticket',
        );
        const batchIds: string[] = [],
          received: any[] = [],
          allTotals = new Map<string, number>();
        for (const dish of snapshot.dishes) {
          const input = dto.dishes.find(
            (row) => row.productId === dish.productId,
          );
          if (
            !input ||
            !Array.isArray(input.inputLots) ||
            !input.inputLots.length ||
            input.inputLots.length > 500 ||
            new Set(input.inputLots.map((line) => line.lotId)).size !==
              input.inputLots.length
          )
            throw new BadRequestException(
              'Chọn lô và số lượng nguyên liệu hợp lệ cho từng món.',
            );
          const inputs: any[] = [],
            totals = new Map<string, number>();
          for (const line of input.inputLots) {
            if (!isUUID(line.lotId))
              throw new BadRequestException('Lô hàng không hợp lệ.');
            const quantity = taskNumber(line.quantity);
            const lot = await m
              .getRepository(StockLot)
              .findOneBy({ id: line.lotId });
            if (
              !lot ||
              !dish.requirements.some(
                (requirement) => requirement.productId === lot.productId,
              )
            )
              throw new BadRequestException(
                'Lô không thuộc thành phần công thức.',
              );
            const stock = await m
              .getRepository(Stock)
              .findOneBy({ id: lot.stockId, branchId: source.branchId });
            if (!stock || (lot.expiresAt && lot.expiresAt < localDate()))
              throw new BadRequestException(
                'Lô không thuộc chi nhánh hoặc đã hết hạn.',
              );
            totals.set(
              lot.productId,
              (totals.get(lot.productId) || 0) + quantity,
            );
            allTotals.set(lot.id, (allTotals.get(lot.id) || 0) + quantity);
            if (allTotals.get(lot.id)! > Number(lot.quantity))
              throw new ConflictException(`Lô ${lot.lotCode} không đủ tồn.`);
            inputs.push({
              lotId: lot.id,
              productId: lot.productId,
              lotCode: lot.lotCode,
              quantity,
              unit: dish.requirements.find((r) => r.productId === lot.productId)
                .unit,
            });
          }
          for (const requirement of dish.requirements)
            if (
              (totals.get(requirement.productId) || 0) + 0.00005 <
              requirement.quantity
            )
              throw new BadRequestException(
                `Chưa nhận đủ ${requirement.name} theo định mức.`,
              );
          let batch = source.row;
          if (type === 'ticket') {
            let plan = await m.getRepository(KitchenMealPlan).findOneBy({
              branchId: source.branchId,
              planDate: source.date,
              mealPeriod: 'LUNCH',
            });
            if (!plan)
              plan = await m.getRepository(KitchenMealPlan).save({
                branchId: source.branchId,
                planDate: source.date,
                mealPeriod: 'LUNCH',
                status: 'LOCKED',
                createdBy: actor.userId,
              });
            batch = await m.getRepository(KitchenProductionBatch).save({
              mealPlanId: plan.id,
              mealItemId: null,
              productId: dish.productId,
              plannedQuantity: dish.quantity,
              adjustmentQuantity: 0,
              source: 'CANTEEN',
              stationId: source.row.stationId,
              shift: source.shift,
              status: 'WAITING',
              details: { workflowTicketId: id, workflowTaskId: id },
              createdBy: actor.userId,
            });
          } else {
            batch.details = { ...batch.details, workflowTaskId: id };
            await m.save(KitchenProductionBatch, batch);
          }
          batchIds.push(batch.id);
          received.push({
            batchId: batch.id,
            productId: dish.productId,
            name: dish.name,
            inputLots: inputs,
          });
        }
        flow.payload = {
          ...flow.payload,
          originalSnapshot: flow.payload.originalSnapshot || outstanding,
          waitingForStock: false,
          ownerId: actor.userId,
          ownerName:
            (
              await m.getRepository(User).findOne({
                where: { id: actor.userId },
                select: ['id', 'fullName'],
              })
            )?.fullName || 'Nhân viên bếp',
          snapshot,
          batchIds,
          received,
        };
        flow.status = 'RECEIVED';
      }
      if (action === 'start') {
        for (const entry of flow.payload.received) {
          const batch = await m
            .getRepository(KitchenProductionBatch)
            .findOneByOrFail({ id: entry.batchId });
          await ops.transition(
            actor,
            batch.id,
            {
              expectedVersion: batch.version,
              inputLots: entry.inputLots.map((line) => ({
                lotId: line.lotId,
                quantity: line.quantity,
              })),
            },
            'PREPARING',
          );
        }
        if (type === 'ticket')
          await m.getRepository(KitchenOrderTicket).update(
            { id },
            {
              status: 'PREPARING',
              startedAt: source.row.startedAt || new Date(),
              updatedBy: actor.userId,
            },
          );
        flow.status = 'PREPARING';
      }
      if (action === 'record') {
        if (
          !Array.isArray(dto.actuals) ||
          dto.actuals.length !== flow.payload.received.length
        )
          throw new BadRequestException('Ghi nhận thực tế cho đủ các món.');
        const actuals: any[] = [];
        for (const entry of flow.payload.received) {
          const actual = dto.actuals.find(
            (row) => row.batchId === entry.batchId,
          );
          if (
            !actual ||
            !Array.isArray(actual.lots) ||
            actual.lots.length !== entry.inputLots.length ||
            new Set(actual.lots.map((line) => line.lotId)).size !==
              actual.lots.length
          )
            throw new BadRequestException(
              'Ghi nhận lượng dùng thực tế của từng lô.',
            );
          const quantity = taskNumber(actual.quantity);
          const dish = flow.payload.snapshot.dishes.find(
            (row) => row.productId === entry.productId,
          );
          if (type === 'ticket' && quantity !== dish.quantity)
            throw new BadRequestException(
              'Sản lượng đạt phải bằng số suất đã nhận của đợt này. Ghi chú hao hụt để bếp trưởng xử lý.',
            );
          if (!Number.isSafeInteger(quantity) || quantity > 10000)
            throw new BadRequestException(
              'Sản lượng phải là số nguyên tối đa 10000.',
            );
          const losses: any[] = [];
          for (const input of entry.inputLots) {
            const line = actual.lots.find((row) => row.lotId === input.lotId);
            if (!line) throw new BadRequestException('Thiếu lô thực tế.');
            const used = taskNumber(line.used, true),
              waste = taskNumber(line.waste, true),
              returned = validateTaskActuals(input.quantity, used, waste);
            if (waste > 0 && !String(actual.note || '').trim())
              throw new BadRequestException('Cần ghi lý do hao hụt.');
            losses.push({ lotId: input.lotId, used, waste, returned });
          }
          for (const requirement of dish.requirements) {
            const used = losses.reduce((sum, line) => {
              const input = entry.inputLots.find(
                (row) => row.lotId === line.lotId,
              );
              return (
                sum +
                (input.productId === requirement.productId ? line.used : 0)
              );
            }, 0);
            if (used <= 0)
              throw new BadRequestException(
                `Cần ghi nhận lượng thực dùng của ${requirement.name}.`,
              );
            if (type === 'ticket' && used + 0.00005 < requirement.quantity)
              throw new BadRequestException(
                `Lượng thực dùng của ${requirement.name} chưa đủ định lượng đợt này.`,
              );
          }
          const batch = await m
            .getRepository(KitchenProductionBatch)
            .findOneByOrFail({ id: entry.batchId });
          batch.details = { ...batch.details, actualLots: losses };
          batch.actualQuantity = quantity;
          await m.save(KitchenProductionBatch, batch);
          actuals.push({
            batchId: batch.id,
            quantity,
            note: String(actual.note || '').trim(),
            lots: losses,
          });
        }
        flow.payload.actuals = actuals;
        flow.status = 'RECORDED';
      }
      if (action === 'complete') {
        if (dto.qualityPassed !== true)
          throw new BadRequestException('Cần xác nhận thành phẩm đạt yêu cầu.');
        for (const entry of flow.payload.received) {
          const actual = flow.payload.actuals.find(
            (row) => row.batchId === entry.batchId,
          );
          for (const line of actual.lots)
            if (line.returned > 0) {
              const lot = await m
                .getRepository(StockLot)
                .findOneByOrFail({ id: line.lotId });
              await this.movements.change(
                m,
                lot.stockId,
                lot.productId,
                line.returned,
                entry.batchId,
                {
                  lotCode: lot.lotCode,
                  manufacturedAt: lot.manufacturedAt,
                  expiresAt: lot.expiresAt,
                  actorId: actor.userId,
                },
              );
            }
          let batch = await m
            .getRepository(KitchenProductionBatch)
            .findOneByOrFail({ id: entry.batchId });
          batch.details.inputLots = actual.lots
            .filter((line) => line.used + line.waste > 0)
            .map((line) => ({
              lotId: line.lotId,
              quantity: line.used + line.waste,
            }));
          await m.save(KitchenProductionBatch, batch);
          const dish = flow.payload.snapshot.dishes.find(
            (row) => row.productId === entry.productId,
          );
          if (
            type === 'ticket' &&
            Number(batch.actualQuantity) !== dish.quantity
          )
            throw new ConflictException(
              'Sản lượng đạt chưa đủ số lượng đơn hàng.',
            );
          if (dish.requiresSample) {
            const sample = dto.samples?.find((row) => row.batchId === batch.id);
            if (sample)
              await ops.write(actor, 'samples', {
                batchId: batch.id,
                quantity: taskNumber(sample.quantity),
                unit: sample.unit,
                storageLocation: sample.storageLocation,
              });
          }
          batch = await ops.transition(
            actor,
            batch.id,
            { expectedVersion: batch.version },
            'READY',
          );
          batch = await ops.transition(
            actor,
            batch.id,
            { expectedVersion: batch.version },
            'COMPLETED',
          );
          const imported = await ops.write(actor, 'finished-imports', {
            batchId: batch.id,
            quantity: Number(batch.actualQuantity),
            receiverArea: 'Bếp',
            receivedBy: actor.userId,
          });
          await ops.action(actor, 'finished-imports', imported.id, 'confirm');
        }
        const rounds = flow.payload.rounds || [];
        const outstanding = remainingTaskSnapshot(
          flow.payload.originalSnapshot || flow.payload.snapshot,
          [
            ...rounds,
            {
              snapshot: flow.payload.snapshot,
            },
          ],
        );
        const hasRemaining = type === 'ticket' && outstanding.dishes.length > 0;
        if (type === 'ticket' && !hasRemaining) {
          await m
            .getRepository(KitchenOrderTicket)
            .update(
              { id },
              { status: 'READY', readyAt: new Date(), updatedBy: actor.userId },
            );
          await m
            .getRepository(Order)
            .update(
              { id: source.row.orderId },
              { status: ORDER_STATUS.READY_TO_PICKUP, updatedBy: actor.userId },
            );
        }
        flow.payload.quality = {
          passed: true,
          checkedBy: actor.userId,
          checkedAt: new Date().toISOString(),
        };
        if (hasRemaining) {
          flow.payload.rounds = [
            ...rounds,
            {
              snapshot: flow.payload.snapshot,
              received: flow.payload.received,
              actuals: flow.payload.actuals,
              completedAt: new Date().toISOString(),
              quality: flow.payload.quality,
            },
          ];
          flow.payload.snapshot = outstanding;
          flow.payload.received = [];
          flow.payload.actuals = [];
          flow.payload.batchIds = [];
          flow.payload.waitingForStock = true;
          flow.status = 'WAITING';
        } else {
          flow.payload.received = [
            ...rounds
              .filter((round: any) => !round.handover)
              .flatMap((round: any) => round.received),
            ...flow.payload.received,
          ];
          flow.payload.actuals = [
            ...rounds
              .filter((round: any) => !round.handover)
              .flatMap((round: any) => round.actuals),
            ...flow.payload.actuals,
          ];
          flow.payload.batchIds = flow.payload.received.map(
            (entry: any) => entry.batchId,
          );
          flow.status = 'COMPLETED';
        }
      }
      if (action === 'handover' || action === 'handover-partial') {
        const partial = action === 'handover-partial';
        if (
          partial &&
          (type !== 'ticket' ||
            !['ADMIN', 'MANAGER', 'HEAD_CHEF'].includes(actor.userType) ||
            dto.confirmPartial !== true)
        )
          throw new BadRequestException(
            'Bếp trưởng/Quản lý cần xác nhận bàn giao một phần đơn.',
          );
        const pendingRounds = (flow.payload.rounds || []).filter(
          (round: any) => !round.handover,
        );
        const batchIds: string[] = partial
          ? pendingRounds.flatMap((round: any) =>
              round.received.map((entry: any) => entry.batchId),
            )
          : flow.payload.batchIds;
        if (!batchIds.length)
          throw new BadRequestException(
            'Không có đợt đã hoàn thành chờ bàn giao.',
          );
        const receivedBy = String(dto.receivedBy || '').trim();
        const receiverPlace =
          String(dto.receiverPlace || '').trim() ||
          (type === 'ticket' ? 'Quầy căn tin' : 'Khu chia suất bán trú');
        if (receiverPlace.length > 200)
          throw new BadRequestException('Nơi nhận tối đa 200 ký tự.');
        if (!receivedBy || receivedBy.length > 200 || !Array.isArray(dto.items))
          throw new BadRequestException('Cần ghi số lượng giao và người nhận.');
        if (dto.items.length !== batchIds.length)
          throw new BadRequestException('Cần bàn giao đủ các món.');
        const handed: any[] = [];
        for (const batchId of batchIds) {
          const batch = await m
            .getRepository(KitchenProductionBatch)
            .findOneByOrFail({ id: batchId });
          const item = dto.items.find((row) => row.batchId === batchId);
          if (
            !item ||
            taskNumber(item.quantity) !== Number(batch.actualQuantity)
          )
            throw new BadRequestException(
              'Lần bàn giao này cần giao đủ sản lượng đã hoàn tất.',
            );
          const imported = await repo.findOneByOrFail({
            kind: 'finished-imports',
            parentId: batchId,
            branchId: source.branchId,
            status: 'CONFIRMED',
          });
          await ops.write(actor, 'finished-exports', {
            lotId: imported.payload.lotId,
            quantity: Number(item.quantity),
            receiverPlace,
            receivedBy,
            deliveredBy: actor.userId,
          });
          handed.push({ batchId, quantity: Number(item.quantity) });
        }
        if (type === 'ticket' && !partial) {
          await m.getRepository(KitchenOrderTicket).update(
            { id },
            {
              status: 'DELIVERED',
              deliveredAt: new Date(),
              updatedBy: actor.userId,
            },
          );
          await m.getRepository(Order).update(
            { id: source.row.orderId },
            {
              status: ORDER_STATUS.DONE,
              completedAt: new Date(),
              updatedBy: actor.userId,
            },
          );
          await m.getRepository(OrderStatusLog).save({
            orderId: source.row.orderId,
            oldStatus: ORDER_STATUS.READY_TO_PICKUP,
            newStatus: ORDER_STATUS.DONE,
            changedBy: actor.userId,
            reason: 'KITCHEN_HANDOVER',
            createdBy: actor.userId,
          });
        }
        const handover = {
          items: handed,
          receivedBy,
          receiverPlace,
          deliveredBy: actor.userId,
          deliveredAt: new Date().toISOString(),
        };
        if (partial) {
          for (const round of pendingRounds) round.handover = handover;
          flow.payload.partialHandovers = [
            ...(flow.payload.partialHandovers || []),
            handover,
          ];
        } else {
          flow.payload.handover = handover;
          flow.status = 'HANDED_OVER';
        }
      }
      flow.payload.history.push({
        action,
        actorId: actor.userId,
        at: new Date().toISOString(),
      });
      flow.payload.requests[dto.requestId] = fingerprint;
      flow.updatedBy = actor.userId;
      await repo.save(flow);
      return this.detail(m, actor, type, id);
    });
    afterCommit.forEach((publish) => publish());
    return result;
  }
}
