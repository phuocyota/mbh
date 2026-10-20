import {
  BadRequestException,
  ConflictException,
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
      if (!recipe) {
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
  private async detail(m: EntityManager, actor: any, type: string, id: string) {
    const source = await this.source(m, actor, type, id);
    const flow = await m.getRepository(KitchenOperation).findOneBy({
      kind: 'task-flow',
      parentId: id,
      branchId: source.branchId,
    });
    const snapshot =
      flow?.payload.snapshot || (await this.requirements(m, source, type));
    const productIds = [
      ...new Set(
        snapshot.dishes.flatMap((dish) =>
          dish.requirements.map((line) => line.productId),
        ),
      ),
    ] as string[];
    const lots = productIds.length
      ? await m.query(
          `SELECT l.id,l.product_id AS "productId",l.lot_code AS "lotCode",l.quantity,l.expires_at AS "expiresAt",s.name AS "stockName" FROM stock_lots l JOIN stocks s ON s.id=l.stock_id WHERE s.branch_id=$1 AND l.product_id=ANY($2::uuid[]) AND l.quantity>0 AND (l.expires_at IS NULL OR l.expires_at >= $3::date) ORDER BY l.expires_at ASC NULLS LAST,l.id`,
          [source.branchId, productIds, localDate()],
        )
      : [];
    return {
      id,
      type,
      date: source.date,
      shift: source.shift,
      sourceStatus: source.row.status,
      deadline: source.row.details?.deadline || null,
      name:
        type === 'ticket'
          ? `Đơn ${source.row.order?.orderNumber || source.row.orderId}`
          : snapshot.dishes[0]?.name || 'Mẻ chế biến',
      status:
        flow?.status ||
        (source.row.status === 'WAITING' ? 'WAITING' : 'LEGACY'),
      version: flow?.version || 0,
      ...snapshot,
      lots,
      history: flow?.payload.history || [],
      received: flow?.payload.received || [],
      actuals: flow?.payload.actuals || [],
      ownerId: flow?.payload.ownerId,
      ownerName: flow?.payload.ownerName,
      handover: flow?.payload.handover,
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
        await m
          .getRepository(Order)
          .findOne({
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
      if (source.date !== localDate() && action !== 'handover')
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
      if (action === 'receive') {
        if (source.row.status !== 'WAITING')
          throw new ConflictException(
            'Nhiệm vụ đã bắt đầu ở luồng khác. Hãy làm mới.',
          );
        const snapshot = await this.requirements(m, source, type);
        if (snapshot.missingRecipes.length)
          throw new BadRequestException(
            `Chưa có công thức đang áp dụng: ${snapshot.missingRecipes.join(', ')}.`,
          );
        if (!snapshot.dishes.length)
          throw new BadRequestException('Đơn không có món phải chế biến.');
        if (
          !Array.isArray(dto.dishes) ||
          dto.dishes.length !== snapshot.dishes.length
        )
          throw new BadRequestException(
            'Cần xác nhận nguyên liệu cho đủ các món.',
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
              startedAt: new Date(),
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
          if (type === 'ticket' && quantity < dish.quantity)
            throw new BadRequestException(
              'Sản lượng đạt cần đủ số lượng đơn. Có thể ghi chú hao hụt để bếp trưởng xử lý.',
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
          if (type === 'ticket' && Number(batch.actualQuantity) < dish.quantity)
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
        if (type === 'ticket') {
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
        flow.status = 'COMPLETED';
      }
      if (action === 'handover') {
        const receivedBy = String(dto.receivedBy || '').trim();
        if (!receivedBy || receivedBy.length > 200 || !Array.isArray(dto.items))
          throw new BadRequestException('Cần ghi số lượng giao và người nhận.');
        if (dto.items.length !== flow.payload.batchIds.length)
          throw new BadRequestException('Cần bàn giao đủ các món.');
        const handed: any[] = [];
        for (const batchId of flow.payload.batchIds) {
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
            receiverPlace: String(dto.receiverPlace || 'Bàn giao bếp'),
            receivedBy,
            deliveredBy: actor.userId,
          });
          handed.push({ batchId, quantity: Number(item.quantity) });
        }
        if (type === 'ticket') {
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
        flow.payload.handover = {
          items: handed,
          receivedBy,
          deliveredBy: actor.userId,
          deliveredAt: new Date().toISOString(),
        };
        flow.status = 'HANDED_OVER';
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
