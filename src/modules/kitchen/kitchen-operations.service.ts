import { requestFingerprint } from '../../common/utils/request-fingerprint';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import { StockMovementService } from '../stock/stock-movement.service';
import {
  KitchenOperation,
  KitchenProductionBatch,
  KitchenMealPlan,
  Product,
} from '../../entities';
import { SocketService } from '../socket/socket.service';
import { resolveStockBranch, canUseStockProduct } from '../stock/stock-scope';
import { localDate, positive } from '../stock/stock-movement.service';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';
import { MEAL_PERIOD_VALUES } from '../../common/constant/constant';

export const OPERATION_KINDS = [
  'menus',
  'manual-plans',
  'finished-imports',
  'finished-exports',
  'disposals',
  'samples',
  'shift-closings',
  'finished-inventory',
] as const;
function required(value: any, name: string) {
  if (typeof value !== 'string' || !value.trim())
    throw new BadRequestException(`${name}_REQUIRED`);
  return value.trim();
}
function instant(value: any, name: string) {
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value)) ||
    !/(Z|[+-]\d\d:\d\d)$/.test(value)
  )
    throw new BadRequestException(`${name}_TIMEZONE_REQUIRED`);
  return new Date(value).toISOString();
}
function reschedule(value: string, date: string) {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
  return new Date(date + 'T' + time + '+07:00').toISOString();
}
function productionDate(value: any) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value || '') ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('INVALID_DATE');
  return value;
}

@Injectable()
export class KitchenOperationsService {
  constructor(
    private db: DataSource,
    private config: ConfigService,
    private socket: SocketService,
    private movements: StockMovementService = new StockMovementService(),
  ) {}
  branch(actor: any, requested?: string) {
    if (String(this.config.get('KITCHEN_MODULE_ENABLED')) !== 'true')
      throw new ServiceUnavailableException('KITCHEN_MODULE_DISABLED');
    return resolveStockBranch(actor, requested);
  }
  manager(actor: any) {
    if (!['ADMIN', 'MANAGER'].includes(actor.userType))
      throw new ForbiddenException('MANAGER_REQUIRED');
  }
  async lock(m: EntityManager, branchId: string) {
    await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `kitchen:${branchId}`,
    ]);
  }
  async unlocked(
    m: EntityManager,
    branchId: string,
    date: string,
    shift: string,
  ) {
    const rows = await m.getRepository(KitchenOperation).find({
      where: {
        branchId,
        kind: 'shift-closings',
        date,
        shift,
        status: In(['LOCKED', 'CONFIRMED']),
      },
    });
    if (rows.length) throw new ConflictException('KITCHEN_SHIFT_LOCKED');
  }
  async list(actor: any, kind: string, q: any = {}) {
    if (!OPERATION_KINDS.includes(kind as any))
      throw new NotFoundException('RESOURCE_NOT_FOUND');
    const branchId = this.branch(actor, q.branchId),
      p = normalizePagination(q.page, q.size);
    const qb = this.db
      .getRepository(KitchenOperation)
      .createQueryBuilder('r')
      .where('r.branch_id=:branchId AND r.kind=:kind', { branchId, kind });
    if (q.date) qb.andWhere('r.date=:date', { date: q.date });
    if (q.from) qb.andWhere('r.date>=:from', { from: q.from });
    if (q.to) qb.andWhere('r.date<=:to', { to: q.to });
    if (q.shift) qb.andWhere('r.shift=:shift', { shift: q.shift });
    if (
      kind === 'finished-inventory' &&
      ['AVAILABLE', 'EXPIRED', 'QUARANTINED'].includes(q.status)
    ) {
      if (q.status === 'QUARANTINED')
        qb.andWhere("(r.payload->>'quarantinedQuantity')::numeric>0");
      else
        qb.andWhere(
          `(r.payload->>'expiresAt')::timestamptz ${q.status === 'EXPIRED' ? '<=' : '>'} now()`,
        ).andWhere("(r.payload->>'availableQuantity')::numeric>0");
    } else if (q.status) qb.andWhere('r.status=:status', { status: q.status });
    if (q.productId)
      qb.andWhere("r.payload->>'productId'=:productId", {
        productId: q.productId,
      });
    const [rows, total] = await qb
      .orderBy('r.created_at', 'DESC')
      .skip(p.skip)
      .take(p.size)
      .getManyAndCount();
    const data =
      kind === 'finished-inventory'
        ? rows.map((row) => {
            const expired = Date.parse(row.payload.expiresAt) <= Date.now();
            return {
              ...row,
              payload: {
                ...row.payload,
                physicalQuantity:
                  Number(row.payload.availableQuantity) +
                  Number(row.payload.quarantinedQuantity),
                usableQuantity: expired
                  ? 0
                  : Number(row.payload.availableQuantity),
                expiredQuantity: expired
                  ? Number(row.payload.availableQuantity)
                  : 0,
                availabilityStatus: expired ? 'EXPIRED' : 'AVAILABLE',
              },
            };
          })
        : rows;
    return toPaginationResponse(data, total, p.page, p.size);
  }
  async get(actor: any, kind: string, id: string) {
    const r = await this.db
      .getRepository(KitchenOperation)
      .findOneBy({ id, kind });
    if (!r) throw new NotFoundException('DOCUMENT_NOT_FOUND');
    this.branch(actor, r.branchId);
    return r;
  }
  async product(m: EntityManager, branchId: string, id: string) {
    if (!id || !isUUID(id))
      throw new BadRequestException('FINISHED_GOOD_REQUIRED');
    const p = await m.getRepository(Product).findOneBy({ id, isActive: true });
    if (
      !p ||
      p.productType !== 'FINISHED_GOOD' ||
      !(await canUseStockProduct(m, p, branchId))
    )
      throw new BadRequestException('FINISHED_GOOD_REQUIRED');
    return p;
  }
  async write(actor: any, kind: string, dto: any, id?: string) {
    if (
      ![
        'menus',
        'manual-plans',
        'finished-imports',
        'finished-exports',
        'disposals',
        'samples',
        'shift-closings',
      ].includes(kind)
    )
      throw new NotFoundException('RESOURCE_NOT_FOUND');
    if (['menus', 'manual-plans'].includes(kind)) this.manager(actor);
    const existing = id ? await this.get(actor, kind, id) : null;
    const branchId = this.branch(actor, existing?.branchId || dto.branchId);
    const result = await this.db.transaction(async (m) => {
      await this.lock(m, branchId);
      const productIds =
        kind === 'menus'
          ? dto.productIds || existing?.payload.productIds || []
          : kind === 'manual-plans'
            ? (dto.items || existing?.payload.items || []).map(
                (line) => line.productId,
              )
            : [];
      await this.movements.lockProducts(
        m,
        productIds.filter((id) => typeof id === 'string'),
      );
      const repo = m.getRepository(KitchenOperation);
      if (dto.requestId && !id) {
        const old = await repo.findOneBy({
          branchId,
          requestId: dto.requestId,
        });
        if (old) {
          if (
            old.kind !== kind ||
            requestFingerprint(old.payload._request) !== requestFingerprint(dto)
          )
            throw new ConflictException('IDEMPOTENCY_PAYLOAD_CONFLICT');
          return old;
        }
      }
      const previous = id
        ? await repo.findOne({
            where: { id, branchId, kind },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      if (
        previous &&
        ['finished-imports', 'samples'].includes(kind) &&
        dto.batchId &&
        dto.batchId !== previous.payload.batchId
      )
        throw new BadRequestException('SOURCE_BATCH_IMMUTABLE');
      if (previous) {
        if (dto.expectedVersion !== previous.version)
          throw new ConflictException('DOCUMENT_VERSION_CONFLICT');
        if (previous.status !== 'DRAFT' && !['samples'].includes(kind))
          throw new ConflictException('DOCUMENT_IMMUTABLE');
        if (previous.status === 'PROCESSED')
          throw new ConflictException('DOCUMENT_IMMUTABLE');
      }
      let date = productionDate(previous?.date || dto.date || localDate()),
        shift = required(previous?.shift || dto.shift || 'Ca trưa', 'SHIFT');
      const payload = { ...(previous?.payload || {}), ...dto };
      delete payload.expectedVersion;
      delete payload.branchId;
      delete payload.requestId;
      delete payload.date;
      delete payload.shift;
      delete payload.status;
      delete payload.version;
      delete payload.id;
      let parentId: string | null = previous?.parentId || null,
        status = previous?.status || 'DRAFT';
      if (kind === 'menus') {
        required(payload.title, 'TITLE');
        if (!MEAL_PERIOD_VALUES.includes(payload.mealPeriod))
          throw new BadRequestException('INVALID_MEAL_PERIOD');
        if (!Array.isArray(payload.productIds) || !payload.productIds.length)
          throw new BadRequestException('MENU_PRODUCTS_REQUIRED');
        for (const pid of payload.productIds)
          await this.product(m, branchId, pid);
      }
      if (kind === 'manual-plans') {
        if (!MEAL_PERIOD_VALUES.includes(payload.mealPeriod))
          throw new BadRequestException('INVALID_MEAL_PERIOD');
        if (!Array.isArray(payload.items) || !payload.items.length)
          throw new BadRequestException('PLAN_ITEMS_REQUIRED');
        const confirmed = (previous?.payload.items || []).filter(
          (i) => i.batchId,
        );
        for (const old of previous?.payload.items || [])
          await this.unlocked(m, branchId, date, old.shift || shift);
        for (const line of payload.items) {
          line.id = line.id || randomUUID();
          await this.product(m, branchId, line.productId);
          positive(line.expectedQuantity);
          if (!Number.isInteger(Number(line.expectedQuantity)))
            throw new BadRequestException('INTEGER_PORTIONS_REQUIRED');
          line.shift = required(line.shift || shift, 'SHIFT');
          await this.unlocked(m, branchId, date, line.shift);
          line.plannedStartAt = instant(line.plannedStartAt, 'PLANNED_START');
          if (localDate(new Date(line.plannedStartAt)) !== date)
            throw new BadRequestException('PLAN_START_DATE_MISMATCH');
          line.deadline = instant(line.deadline, 'DEADLINE');
          if (line.deadline < line.plannedStartAt)
            throw new BadRequestException('INVALID_DEADLINE');
          required(line.serviceArea, 'SERVICE_AREA');
          if (!line.stationId)
            throw new BadRequestException('STATION_REQUIRED');
          const [station] = await m.query(
            'SELECT id FROM kitchen_stations WHERE id=$1 AND branch_id=$2 AND is_active=true',
            [line.stationId, branchId],
          );
          if (!station) throw new BadRequestException('INVALID_STATION');
        }
        if (
          new Set(payload.items.map((i) => i.id)).size !== payload.items.length
        )
          throw new BadRequestException('DUPLICATE_PLAN_LINE');
        for (const old of confirmed) {
          const next = payload.items.find((i) => i.id === old.id);
          if (!next || requestFingerprint(next) !== requestFingerprint(old))
            throw new ConflictException('CONFIRMED_LINE_IMMUTABLE');
        }
        for (const line of payload.items) {
          const old = previous?.payload.items?.find((i) => i.id === line.id);
          if (line.batchId && line.batchId !== old?.batchId)
            throw new BadRequestException('INVALID_BATCH_REFERENCE');
        }
      }
      if (['finished-imports', 'samples'].includes(kind)) {
        const batch = await this.batch(m, actor, payload.batchId);
        const plan = await m
          .getRepository(KitchenMealPlan)
          .findOneByOrFail({ id: batch.mealPlanId });
        date = plan.planDate;
        shift = batch.shift;
        payload.productId = batch.productId;
        parentId = batch.id;
        if (kind === 'finished-imports') {
          if (batch.status !== 'COMPLETED')
            throw new ConflictException('BATCH_NOT_COMPLETED');
          positive(payload.quantity);
          required(payload.receiverArea, 'RECEIVER_AREA');
          if (!batch.readyAt)
            throw new ConflictException('BATCH_READY_TIME_REQUIRED');
          const dish = await this.product(m, branchId, batch.productId);
          payload.importedAt = instant(
            payload.importedAt || new Date().toISOString(),
            'IMPORTED_AT',
          );
          payload.expiresAt =
            batch.details.servingExpiresAt ||
            new Date(
              new Date(batch.readyAt).getTime() +
                Number(dish.recommendedUseMinutes) * 60000,
            ).toISOString();
        }
        if (kind === 'samples') {
          if (!['PREPARING', 'READY', 'COMPLETED'].includes(batch.status))
            throw new ConflictException('BATCH_NOT_STARTED');
          positive(payload.quantity);
          if (!['g', 'ml'].includes(payload.unit))
            throw new BadRequestException('SAMPLE_UNIT_REQUIRED');
          required(payload.storageLocation, 'STORAGE_LOCATION');
          payload.sampledAt = instant(
            payload.sampledAt || new Date().toISOString(),
            'SAMPLED_AT',
          );
          if (
            Date.parse(payload.sampledAt) > Date.now() ||
            Date.parse(payload.sampledAt) < new Date(batch.startedAt!).getTime()
          )
            throw new BadRequestException('INVALID_SAMPLE_TIME');
          payload.storageStartedAt = instant(
            payload.storageStartedAt || payload.sampledAt,
            'STORAGE_STARTED',
          );
          payload.expectedEndAt = instant(
            payload.expectedEndAt ||
              new Date(
                Date.parse(payload.storageStartedAt) + 86400000,
              ).toISOString(),
            'SAMPLE_END',
          );
          if (payload.expectedEndAt <= payload.storageStartedAt)
            throw new BadRequestException('INVALID_SAMPLE_END');
          status = 'STORED';
        }
      }
      if (['finished-exports', 'disposals'].includes(kind)) {
        const lot = await repo.findOne({
          where: { id: payload.lotId, branchId, kind: 'finished-inventory' },
          lock: { mode: 'pessimistic_write' },
        });
        if (!lot) throw new NotFoundException('FINISHED_LOT_NOT_FOUND');
        date = lot.date;
        shift = lot.shift;
        payload.productId = lot.payload.productId;
        parentId = lot.id;
        const qty = positive(payload.quantity);
        if (kind === 'finished-exports') {
          if (new Date(lot.payload.expiresAt) <= new Date())
            throw new ConflictException('FINISHED_LOT_EXPIRED');
          required(payload.receiverPlace, 'RECEIVER_PLACE');
          required(payload.receivedBy, 'RECEIVED_BY');
          if (Number(lot.payload.availableQuantity) < qty)
            throw new ConflictException('FINISHED_STOCK_SHORTAGE');
          lot.payload.availableQuantity =
            Number(lot.payload.availableQuantity) - qty;
          await repo.save(lot);
          status = 'EXPORTED';
          payload.exportedAt = new Date().toISOString();
        } else {
          required(payload.reason, 'REASON');
          if (!['AVAILABLE', 'QUARANTINED'].includes(payload.pool))
            throw new BadRequestException('DISPOSAL_POOL_REQUIRED');
          status = 'PENDING';
        }
      }
      if (kind === 'shift-closings') {
        const old = await repo.findOneBy({ branchId, kind, date, shift });
        if (old && !previous) return old;
      }
      await this.unlocked(m, branchId, date, shift);
      payload.actorId = actor.userId;
      if (!id && dto.requestId) payload._request = dto;
      const row = await repo.save(
        repo.create({
          ...previous,
          branchId,
          kind,
          date,
          shift,
          status,
          parentId,
          requestId: previous?.requestId || dto.requestId || null,
          createdBy: previous?.createdBy || actor.userId,
          updatedBy: actor.userId,
          payload,
        }),
      );
      await this.audit(m, actor, row, id ? 'UPDATE' : 'CREATE');
      return row;
    });
    this.notify(branchId, kind);
    return result;
  }
  async batch(m: EntityManager, actor: any, id: string) {
    const b = await m
      .getRepository(KitchenProductionBatch)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!b) throw new NotFoundException('BATCH_NOT_FOUND');
    const p = await m
      .getRepository(KitchenMealPlan)
      .findOneByOrFail({ id: b.mealPlanId });
    this.branch(actor, p.branchId);
    return b;
  }
  async audit(
    m: EntityManager,
    actor: any,
    row: Pick<
      KitchenOperation,
      'id' | 'branchId' | 'kind' | 'date' | 'shift' | 'version' | 'payload'
    >,
    action: string,
  ) {
    const snapshot = { ...row.payload };
    delete snapshot._request;
    await m.getRepository(KitchenOperation).save({
      branchId: row.branchId,
      kind: 'history',
      date: row.date,
      shift: row.shift,
      status: action,
      parentId: row.id,
      payload: {
        resource: row.kind,
        documentId: row.id,
        actorId: actor.userId,
        action,
        documentVersion: row.version,
        snapshot,
      },
      requestId: null,
    });
  }
  notify(branchId: string, kind: string) {
    this.socket.emitKitchenConsumptionUpdated(branchId, {
      branchId,
      resource: kind,
    });
  }
  async action(
    actor: any,
    kind: string,
    id: string,
    action: string,
    dto: any = {},
  ) {
    const current = await this.get(actor, kind, id);
    const branchId = current.branchId;
    if (
      ['menus', 'manual-plans'].includes(kind) ||
      [
        'approve',
        'reopen',
        'adjustments',
        'release',
        'confirm-disposal',
      ].includes(action)
    )
      this.manager(actor);
    const result = await this.db.transaction(async (m) => {
      await this.lock(m, branchId);
      const repo = m.getRepository(KitchenOperation);
      const row = await repo.findOneByOrFail({ id, kind, branchId });
      if (
        ['returns', 'adjustments', 'release', 'copy'].includes(action) &&
        !dto.requestId
      )
        throw new BadRequestException('REQUEST_ID_REQUIRED');
      if (dto.requestId) {
        const prior = await repo.findOneBy({
          branchId,
          requestId: dto.requestId,
        });
        if (prior) {
          if (
            prior.parentId !== id ||
            prior.payload.action !== action ||
            requestFingerprint(prior.payload._request) !==
              requestFingerprint(dto)
          )
            throw new ConflictException('IDEMPOTENCY_PAYLOAD_CONFLICT');
          return prior;
        }
      }
      if (
        kind !== 'shift-closings' &&
        action !== 'copy' &&
        !(kind === 'samples' && action === 'process')
      )
        await this.unlocked(m, branchId, row.date, row.shift);
      if (action === 'copy' && ['menus', 'manual-plans'].includes(kind)) {
        const date = productionDate(dto.date),
          shift = dto.shift || row.shift;
        await this.unlocked(m, branchId, date, shift);
        const payload = JSON.parse(JSON.stringify(row.payload));
        payload.actorId = actor.userId;
        delete payload._request;
        for (const i of payload.items || []) {
          i.id = randomUUID();
          delete i.batchId;
          for (const key of ['plannedStartAt', 'deadline'])
            if (i[key]) i[key] = reschedule(i[key], date);
          i.shift = dto.shift || i.shift || shift;
          await this.unlocked(m, branchId, date, i.shift);
        }
        payload.action = action;
        payload._request = dto;
        const copied = await repo.save(
          repo.create({
            branchId,
            kind,
            date,
            shift,
            status: 'DRAFT',
            payload,
            parentId: id,
            requestId: dto.requestId || null,
            createdBy: actor.userId,
          }),
        );
        await this.audit(m, actor, copied, 'COPY');
        return copied;
      }
      if (kind === 'menus' && action === 'lock') {
        row.status = 'LOCKED';
      } else if (kind === 'manual-plans' && action === 'confirm') {
        const line = row.payload.items.find((i) => i.id === dto.lineId);
        if (!line) throw new NotFoundException('PLAN_LINE_NOT_FOUND');
        if (line.batchId) return row;
        await this.unlocked(m, branchId, row.date, line.shift || row.shift);
        let plan = await m.getRepository(KitchenMealPlan).findOneBy({
          branchId,
          planDate: row.date,
          mealPeriod: row.payload.mealPeriod,
        });
        if (!plan)
          plan = await m.getRepository(KitchenMealPlan).save({
            branchId,
            planDate: row.date,
            mealPeriod: row.payload.mealPeriod,
            status: 'DRAFT',
          });
        const batch = await m.getRepository(KitchenProductionBatch).save({
          mealPlanId: plan.id,
          mealItemId: null,
          productId: line.productId,
          manualLineId: line.id,
          source: 'MANUAL',
          plannedQuantity: line.expectedQuantity,
          shift: line.shift,
          stationId: line.stationId,
          details: { ...line, date: row.date },
          createdBy: actor.userId,
        });
        line.batchId = batch.id;
      } else if (kind === 'finished-imports' && action === 'confirm') {
        if (row.status === 'CONFIRMED') return row;
        const batch = await this.batch(m, actor, row.payload.batchId);
        const imports = await repo.findBy({
          branchId,
          kind,
          status: 'CONFIRMED',
          parentId: batch.id,
        });
        const sum = imports.reduce((s, r) => s + Number(r.payload.quantity), 0);
        if (sum + Number(row.payload.quantity) > Number(batch.actualQuantity))
          throw new ConflictException('IMPORT_EXCEEDS_ACTUAL_QUANTITY');
        const lot = await repo.save({
          branchId,
          kind: 'finished-inventory',
          date: row.date,
          shift: row.shift,
          status: 'ACTIVE',
          parentId: row.id,
          payload: {
            ...row.payload,
            batchId: batch.id,
            lotCode: `ME-${row.id.slice(0, 8)}`,
            availableQuantity: Number(row.payload.quantity),
            quarantinedQuantity: 0,
          },
          requestId: null,
        });
        row.payload.lotId = lot.id;
        row.status = 'CONFIRMED';
      } else if (kind === 'finished-exports' && action === 'returns') {
        const quantity = positive(dto.quantity);
        const lot = await repo.findOneByOrFail({
          id: row.payload.lotId,
          branchId,
          kind: 'finished-inventory',
        });
        const previous = await repo.findBy({
          branchId,
          kind: 'returns',
          parentId: id,
        });
        if (
          previous.reduce((s, r) => s + Number(r.payload.quantity), 0) +
            quantity >
          Number(row.payload.quantity)
        )
          throw new ConflictException('RETURN_EXCEEDS_EXPORT');
        lot.payload.quarantinedQuantity =
          Number(lot.payload.quarantinedQuantity) + quantity;
        await repo.save(lot);
        const returned = await repo.save({
          branchId,
          kind: 'returns',
          date: row.date,
          shift: row.shift,
          status: 'QUARANTINED',
          parentId: id,
          requestId: dto.requestId || null,
          payload: {
            quantity,
            lotId: lot.id,
            reason: required(dto.reason, 'REASON'),
            actorId: actor.userId,
            action,
            _request: dto,
          },
        });
        await this.audit(m, actor, returned, 'RETURN');
        return returned;
      } else if (
        kind === 'finished-inventory' &&
        ['adjustments', 'release'].includes(action)
      ) {
        required(dto.reason, 'REASON');
        const delta =
          action === 'release' ? positive(dto.quantity) : Number(dto.quantity);
        if (!Number.isFinite(delta) || delta === 0)
          throw new BadRequestException('INVALID_QUANTITY');
        if (action === 'release') {
          if (new Date(row.payload.expiresAt) <= new Date())
            throw new ConflictException('FINISHED_LOT_EXPIRED');
          if (Number(row.payload.quarantinedQuantity) < delta)
            throw new ConflictException('FINISHED_STOCK_SHORTAGE');
          row.payload.quarantinedQuantity -= delta;
        }
        if (Number(row.payload.availableQuantity) + delta < 0)
          throw new ConflictException('FINISHED_STOCK_SHORTAGE');
        row.payload.availableQuantity =
          Number(row.payload.availableQuantity) + delta;
        const event = await repo.save({
          branchId,
          kind: action,
          date: row.date,
          shift: row.shift,
          status: 'COMPLETED',
          parentId: id,
          requestId: dto.requestId || null,
          payload: {
            quantity: delta,
            reason: dto.reason,
            action,
            _request: dto,
            actorId: actor.userId,
          },
        });
        await repo.save(row);
        await this.audit(m, actor, event, action);
        return event;
      } else if (kind === 'disposals' && action === 'confirm-disposal') {
        if (row.status === 'COMPLETED') return row;
        const lot = await repo.findOneByOrFail({
          id: row.payload.lotId,
          branchId,
          kind: 'finished-inventory',
        });
        const key =
          row.payload.pool === 'QUARANTINED'
            ? 'quarantinedQuantity'
            : 'availableQuantity';
        if (Number(lot.payload[key]) < Number(row.payload.quantity))
          throw new ConflictException('FINISHED_STOCK_SHORTAGE');
        lot.payload[key] -= Number(row.payload.quantity);
        await repo.save(lot);
        row.status = 'COMPLETED';
        row.payload.confirmedBy = actor.userId;
      } else if (kind === 'samples' && action === 'process') {
        if (row.status === 'PROCESSED') return row;
        row.status = 'PROCESSED';
        row.payload.processedAt = new Date().toISOString();
        row.payload.processedBy = actor.userId;
        row.payload.processingNote = required(dto.reason, 'REASON');
      } else if (kind === 'shift-closings') {
        if (action === 'confirm') {
          if (row.status !== 'DRAFT') return row;
          const pending = await repo.countBy({
            branchId,
            date: row.date,
            shift: row.shift,
            kind: 'finished-imports',
            status: 'DRAFT',
          });
          if (pending) throw new ConflictException('PENDING_IMPORTS');
          row.status = 'CONFIRMED';
          row.payload.confirmedBy = actor.userId;
          row.payload.confirmedAt = new Date().toISOString();
        } else if (action === 'approve') {
          if (row.status === 'LOCKED') return row;
          if (row.status !== 'CONFIRMED')
            throw new ConflictException('SHIFT_NOT_CONFIRMED');
          row.status = 'LOCKED';
          row.payload.snapshot = await this.reportRows(m, branchId, {
            date: row.date,
            shift: row.shift,
          });
          row.payload.approvedBy = actor.userId;
          row.payload.approvedAt = new Date().toISOString();
        } else if (action === 'reopen') {
          if (row.status !== 'LOCKED' && row.status !== 'CONFIRMED')
            throw new ConflictException('SHIFT_NOT_CLOSED');
          required(dto.reason, 'REASON');
          row.payload.revisions = [
            ...(row.payload.revisions || []),
            {
              snapshot: row.payload.snapshot,
              confirmedBy: row.payload.confirmedBy,
              approvedBy: row.payload.approvedBy,
              reopenedBy: actor.userId,
              reason: dto.reason,
              at: new Date().toISOString(),
            },
          ];
          row.status = 'DRAFT';
          delete row.payload.snapshot;
          delete row.payload.confirmedAt;
          delete row.payload.approvedAt;
        } else throw new BadRequestException('INVALID_ACTION');
      } else throw new BadRequestException('INVALID_ACTION');
      row.updatedBy = actor.userId;
      const saved = await repo.save(row);
      await this.audit(m, actor, saved, action);
      return saved;
    });
    this.notify(branchId, kind);
    return result;
  }
  async transition(actor: any, id: string, dto: any, target: string) {
    const b = await this.db
      .getRepository(KitchenProductionBatch)
      .findOneByOrFail({ id });
    const plan = await this.db
      .getRepository(KitchenMealPlan)
      .findOneByOrFail({ id: b.mealPlanId });
    const branchId = this.branch(actor, plan.branchId);
    const result = await this.db.transaction(async (m) => {
      await this.lock(m, branchId);
      const batch = await this.batch(m, actor, id);
      await this.unlocked(m, branchId, plan.planDate, batch.shift);
      if (batch.version !== Number(dto.expectedVersion))
        throw new ConflictException('KITCHEN_BATCH_VERSION_CONFLICT');
      const allowed = {
        WAITING: 'PREPARING',
        PREPARING: 'READY',
        READY: 'COMPLETED',
      };
      if (target !== 'UPDATE' && allowed[batch.status] !== target)
        throw new ConflictException('INVALID_KITCHEN_BATCH_TRANSITION');
      if (target === 'PREPARING' && plan.planDate !== localDate())
        throw new ConflictException('PRODUCTION_DATE_MISMATCH');
      const product = await m
        .getRepository(Product)
        .findOneByOrFail({ id: batch.productId });
      if (dto.actualQuantity !== undefined) {
        positive(dto.actualQuantity, true);
        const imports = await m.getRepository(KitchenOperation).findBy({
          branchId,
          kind: 'finished-imports',
          parentId: id,
          status: 'CONFIRMED',
        });
        if (
          imports.reduce((s, r) => s + Number(r.payload.quantity), 0) >
          Number(dto.actualQuantity)
        )
          throw new ConflictException('ACTUAL_BELOW_IMPORTED');
        batch.actualQuantity = Number(dto.actualQuantity);
      }
      if (target === 'COMPLETED') {
        if (batch.actualQuantity === null || batch.actualQuantity === undefined)
          throw new BadRequestException('ACTUAL_QUANTITY_REQUIRED');
        if (product.requiresSample) {
          const samples = await m
            .getRepository(KitchenOperation)
            .findBy({ branchId, kind: 'samples', parentId: id });
          if (
            !samples.some(
              (s) =>
                Date.parse(s.payload.sampledAt) >=
                  new Date(batch.startedAt!).getTime() &&
                positive(s.payload.quantity) > 0,
            )
          )
            throw new ConflictException('SAMPLE_REQUIRED');
        }
      }
      if (dto.estimatedDoneAt)
        dto.estimatedDoneAt = instant(dto.estimatedDoneAt, 'ESTIMATED_DONE');
      for (const key of [
        'estimatedDoneAt',
        'note',
        'issueNote',
        'imageUrl',
        'imageName',
      ])
        if (dto[key] !== undefined) batch.details[key] = dto[key];
      if (target !== 'UPDATE') batch.status = target;
      if (target === 'PREPARING') batch.startedAt = new Date();
      if (target === 'READY') {
        batch.readyAt = new Date();
        batch.details.servingExpiresAt = new Date(
          batch.readyAt.getTime() +
            Number(product.recommendedUseMinutes) * 60000,
        ).toISOString();
      }
      if (target === 'COMPLETED') batch.completedAt = new Date();
      batch.updatedBy = actor.userId;
      const saved = await m.save(batch);
      await this.audit(
        m,
        actor,
        {
          id: batch.id,
          branchId,
          kind: 'batches',
          date: plan.planDate,
          shift: batch.shift,
          version: saved.version,
          payload: {
            productId: batch.productId,
            status: batch.status,
            actualQuantity: batch.actualQuantity,
            details: batch.details,
          },
        },
        target,
      );
      return saved;
    });
    this.socket.emitKitchenBatchUpdated(branchId, result);
    return result;
  }
  async reportRows(m: EntityManager, branchId: string, q: any) {
    const qb = m
      .getRepository(KitchenOperation)
      .createQueryBuilder('r')
      .where('r.branch_id=:branchId', { branchId });
    if (q.date) qb.andWhere('r.date=:date', { date: q.date });
    if (q.from) qb.andWhere('r.date>=:from', { from: q.from });
    if (q.to) qb.andWhere('r.date<=:to', { to: q.to });
    if (q.shift) qb.andWhere('r.shift=:shift', { shift: q.shift });
    const rows = await qb.getMany(),
      select = (kind: string, status?: string) =>
        rows.filter((r) => r.kind === kind && (!status || r.status === status)),
      sum = (rs: KitchenOperation[], key = 'quantity') =>
        rs.reduce((s, r) => s + Number(r.payload[key] || 0), 0);
    const from = q.date || q.from || localDate(),
      to = q.date || q.to || from;
    const ticketCounts = await m.query(
      "SELECT status,COUNT(*)::int count FROM kitchen_order_tickets WHERE branch_id=$1 AND (created_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $2::date AND $3::date GROUP BY status",
      [branchId, from, to],
    );
    const batchCounts = await m.query(
      'SELECT b.status,COUNT(*)::int count FROM kitchen_production_batches b JOIN kitchen_meal_plans p ON p.id=b.meal_plan_id WHERE p.branch_id=$1 AND p.plan_date BETWEEN $2::date AND $3::date AND ($4::varchar IS NULL OR b.shift=$4) GROUP BY b.status',
      [branchId, from, to, q.shift || null],
    );
    return {
      ticketCounts,
      batchCounts,
      expiredQuantity: sum(
        select('finished-inventory').filter(
          (r) => Date.parse(r.payload.expiresAt) <= Date.now(),
        ),
        'availableQuantity',
      ),
      importCount: select('finished-imports', 'CONFIRMED').length,
      importedQuantity: sum(select('finished-imports', 'CONFIRMED')),
      exportedQuantity: sum(select('finished-exports')),
      recalledQuantity: sum(select('returns')),
      remainingQuantity: sum(select('finished-inventory'), 'availableQuantity'),
      quarantinedQuantity: sum(
        select('finished-inventory'),
        'quarantinedQuantity',
      ),
      canceledQuantity: sum(select('disposals', 'COMPLETED')),
      cancelCount: select('disposals', 'COMPLETED').length,
      sampleCount: select('samples').length,
      pendingSampleCount: select('samples').filter(
        (r) => r.status !== 'PROCESSED',
      ).length,
    };
  }
  async summary(actor: any, q: any) {
    return this.reportRows(this.db.manager, this.branch(actor, q.branchId), q);
  }
  async history(actor: any, q: any) {
    const branchId = this.branch(actor, q.branchId),
      p = normalizePagination(q.page, q.size);
    const qb = this.db
      .getRepository(KitchenOperation)
      .createQueryBuilder('r')
      .where("r.branch_id=:branchId AND r.kind='history'", { branchId });
    if (q.date) qb.andWhere('r.date=:date', { date: q.date });
    if (q.shift) qb.andWhere('r.shift=:shift', { shift: q.shift });
    if (q.from) qb.andWhere('r.date>=:from', { from: q.from });
    if (q.to) qb.andWhere('r.date<=:to', { to: q.to });
    const [rows, total] = await qb
      .orderBy('r.created_at', 'DESC')
      .skip(p.skip)
      .take(p.size)
      .getManyAndCount();
    return toPaginationResponse(rows, total, p.page, p.size);
  }
}
