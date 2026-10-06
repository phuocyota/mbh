import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  CustomerMealItem,
  Employee,
  KitchenAssignment,
  KitchenBatchAdjustment,
  KitchenConsumptionLine,
  KitchenConsumptionSession,
  KitchenMealPlan,
  KitchenOrderTicket,
  KitchenOrderTicketItem,
  KitchenProductStation,
  KitchenProductionBatch,
  KitchenRecipe,
  KitchenRecipeItem,
  KitchenServicePeriod,
  KitchenStation,
  KitchenStockShortage,
  KITCHEN_BATCH_STATUS,
  KITCHEN_TICKET_STATUS,
  MealItem,
  MeasurementUnit,
  Order,
  OrderStatusLog,
  Product,
  Stock,
  StockItem,
  StockReceiptDetail,
  StockReceiptExport,
  User,
  WorkSchedule,
} from '../../entities';
import {
  COMMON_STATUS,
  MEAL_PERIOD_VALUES,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  USER_ROLE,
} from '../../common/constant/constant';
import { SocketService } from '../socket/socket.service';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';
import {
  assertKitchenTransition,
  calculateRecipeRequirement,
} from './kitchen.rules';

type Actor = { userId: string; userType: string; branchId?: string | null };

@Injectable()
export class KitchenService {
  private readonly activatedAt = new Date();
  constructor(
    @InjectRepository(MeasurementUnit)
    private units: Repository<MeasurementUnit>,
    @InjectRepository(KitchenStation)
    private stations: Repository<KitchenStation>,
    @InjectRepository(KitchenProductStation)
    private productStations: Repository<KitchenProductStation>,
    @InjectRepository(KitchenRecipe) private recipes: Repository<KitchenRecipe>,
    @InjectRepository(KitchenRecipeItem)
    private recipeItems: Repository<KitchenRecipeItem>,
    @InjectRepository(KitchenServicePeriod)
    private periods: Repository<KitchenServicePeriod>,
    @InjectRepository(KitchenOrderTicket)
    private tickets: Repository<KitchenOrderTicket>,
    @InjectRepository(KitchenMealPlan)
    private mealPlans: Repository<KitchenMealPlan>,
    @InjectRepository(KitchenProductionBatch)
    private batches: Repository<KitchenProductionBatch>,
    @InjectRepository(KitchenBatchAdjustment)
    private adjustments: Repository<KitchenBatchAdjustment>,
    @InjectRepository(KitchenConsumptionSession)
    private sessions: Repository<KitchenConsumptionSession>,
    @InjectRepository(KitchenAssignment)
    private assignments: Repository<KitchenAssignment>,
    @InjectRepository(Employee) private employees: Repository<Employee>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(MealItem) private mealItems: Repository<MealItem>,
    @InjectRepository(CustomerMealItem)
    private customerMealItems: Repository<CustomerMealItem>,
    @InjectRepository(WorkSchedule)
    private workSchedules: Repository<WorkSchedule>,
    private dataSource: DataSource,
    private config: ConfigService,
    private socketService: SocketService,
  ) {}

  isEnabled() {
    return (
      String(
        this.config.get('KITCHEN_MODULE_ENABLED') ?? 'false',
      ).toLowerCase() === 'true'
    );
  }

  private ensureEnabled() {
    if (!this.isEnabled())
      throw new ServiceUnavailableException('KITCHEN_MODULE_DISABLED');
  }

  resolveBranch(actor: Actor, requested?: string) {
    this.ensureEnabled();
    if (actor.userType === USER_ROLE.ADMIN) {
      const branchId = requested || actor.branchId;
      if (!branchId)
        throw new BadRequestException('branchId is required for ADMIN');
      return branchId;
    }
    if (!actor.branchId)
      throw new ForbiddenException('KITCHEN_BRANCH_REQUIRED');
    if (requested && requested !== actor.branchId)
      throw new ForbiddenException('CROSS_BRANCH_FORBIDDEN');
    return actor.branchId;
  }

  async linkStaff(actor: Actor, userId: string, employeeId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    const employee = await this.employees.findOne({
      where: { id: employeeId },
    });
    if (!user || !employee)
      throw new NotFoundException('User or employee not found');
    const branchId = this.resolveBranch(actor, employee.branchId);
    if (
      user.role !== USER_ROLE.KITCHEN ||
      user.branchId !== branchId ||
      employee.branchId !== branchId
    )
      throw new BadRequestException('KITCHEN_USER_EMPLOYEE_BRANCH_MISMATCH');
    if (employee.status !== 'working' || user.status !== COMMON_STATUS.ACTIVE)
      throw new BadRequestException('KITCHEN_STAFF_INACTIVE');
    const occupied = await this.employees.findOne({ where: { userId } });
    if (occupied && occupied.id !== employee.id)
      throw new ConflictException('KITCHEN_USER_ALREADY_LINKED');
    employee.userId = userId;
    employee.updatedBy = actor.userId;
    return this.employees.save(employee);
  }

  listUnits() {
    this.ensureEnabled();
    return this.units.find({
      where: { isActive: true },
      order: { dimension: 'ASC', factorToBase: 'ASC' },
    });
  }

  async listStations(actor: Actor, branchId?: string) {
    return this.stations.find({
      where: { branchId: this.resolveBranch(actor, branchId) },
      order: { name: 'ASC' },
    });
  }

  async createStation(actor: Actor, dto: any) {
    const branchId = this.resolveBranch(actor, dto.branchId);
    return this.stations.save(
      this.stations.create({
        ...dto,
        branchId,
        code: String(dto.code).trim().toUpperCase(),
        createdBy: actor.userId,
      }),
    );
  }

  async updateStation(actor: Actor, id: string, dto: any) {
    const row = await this.stations.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Kitchen station not found');
    this.resolveBranch(actor, row.branchId);
    Object.assign(row, dto, {
      branchId: row.branchId,
      updatedBy: actor.userId,
    });
    return this.stations.save(row);
  }

  async deactivateStation(actor: Actor, id: string) {
    return this.updateStation(actor, id, { isActive: false });
  }

  async assignProductStation(
    actor: Actor,
    stationId: string,
    productId: string,
  ) {
    const station = await this.stations.findOne({ where: { id: stationId } });
    const product = await this.products.findOne({ where: { id: productId } });
    if (!station || !product)
      throw new NotFoundException('Station or product not found');
    const branchId = this.resolveBranch(actor, station.branchId);
    if (product.branchId && product.branchId !== branchId)
      throw new ForbiddenException('CROSS_BRANCH_FORBIDDEN');
    let row = await this.productStations.findOne({
      where: { branchId, productId },
    });
    row =
      row ||
      this.productStations.create({
        branchId,
        productId,
        stationId,
        createdBy: actor.userId,
      });
    row.stationId = stationId;
    row.updatedBy = actor.userId;
    return this.productStations.save(row);
  }

  async listRecipes(actor: Actor, branchId?: string, productId?: string) {
    const where: any = { branchId: this.resolveBranch(actor, branchId) };
    if (productId) where.productId = productId;
    return this.recipes.find({
      where,
      relations: [
        'product',
        'yieldUnit',
        'items',
        'items.ingredientProduct',
        'items.unit',
      ],
      order: { productId: 'ASC', version: 'DESC' },
    });
  }

  async createRecipe(actor: Actor, dto: any) {
    const branchId = this.resolveBranch(actor, dto.branchId);
    if (
      !(Number(dto.yieldQuantity) > 0) ||
      !Array.isArray(dto.items) ||
      !dto.items.length
    )
      throw new BadRequestException('Recipe yield and items are required');
    const product = await this.products.findOne({
      where: { id: dto.productId },
    });
    if (!product || (product.branchId && product.branchId !== branchId))
      throw new BadRequestException('RECIPE_PRODUCT_BRANCH_MISMATCH');
    const ids = dto.items.map((item: any) => item.ingredientProductId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('DUPLICATE_RECIPE_INGREDIENT');
    const [yieldUnit, ingredientProducts, itemUnits] = await Promise.all([
      this.units.findOne({ where: { id: dto.yieldUnitId, isActive: true } }),
      this.products.find({ where: { id: In(ids) } }),
      this.units.find({
        where: {
          id: In(dto.items.map((item: any) => item.unitId)),
          isActive: true,
        },
      }),
    ]);
    if (!yieldUnit || ingredientProducts.length !== ids.length)
      throw new BadRequestException('INVALID_RECIPE_REFERENCE');
    if (product.baseUnitId) {
      const productUnit = await this.units.findOne({
        where: { id: product.baseUnitId },
      });
      if (!productUnit || productUnit.dimension !== yieldUnit.dimension) {
        throw new BadRequestException('INCOMPATIBLE_RECIPE_YIELD_UNIT');
      }
    }
    const unitsById = new Map(itemUnits.map((u) => [u.id, u]));
    const productsById = new Map(ingredientProducts.map((p) => [p.id, p]));
    for (const item of dto.items) {
      const ingredient = productsById.get(item.ingredientProductId);
      const unit = unitsById.get(item.unitId);
      const baseUnit = ingredient?.baseUnitId
        ? await this.units.findOne({ where: { id: ingredient.baseUnitId } })
        : null;
      if (
        !(Number(item.quantity) > 0) ||
        !unit ||
        !baseUnit ||
        unit.dimension !== baseUnit.dimension
      )
        throw new BadRequestException(
          `INCOMPATIBLE_INGREDIENT_UNIT:${item.ingredientProductId}`,
        );
      if (ingredient?.branchId && ingredient.branchId !== branchId)
        throw new BadRequestException('RECIPE_INGREDIENT_BRANCH_MISMATCH');
    }
    const latest = await this.recipes.findOne({
      where: { branchId, productId: dto.productId },
      order: { version: 'DESC' },
    });
    return this.dataSource.transaction(async (manager) => {
      const recipe = await manager.save(
        KitchenRecipe,
        manager.create(KitchenRecipe, {
          branchId,
          productId: dto.productId,
          version: (latest?.version || 0) + 1,
          yieldQuantity: dto.yieldQuantity,
          yieldUnitId: dto.yieldUnitId,
          status: dto.activate ? 'ACTIVE' : 'DRAFT',
          effectiveFrom: dto.activate ? new Date() : null,
          createdBy: actor.userId,
        }),
      );
      if (dto.activate)
        await manager.update(
          KitchenRecipe,
          { branchId, productId: dto.productId, status: 'ACTIVE' },
          { status: 'INACTIVE', updatedBy: actor.userId },
        );
      recipe.status = dto.activate ? 'ACTIVE' : 'DRAFT';
      await manager.save(KitchenRecipe, recipe);
      await manager.save(
        KitchenRecipeItem,
        dto.items.map((item: any) =>
          manager.create(KitchenRecipeItem, {
            recipeId: recipe.id,
            ...item,
            createdBy: actor.userId,
          }),
        ),
      );
      return manager.findOne(KitchenRecipe, {
        where: { id: recipe.id },
        relations: [
          'items',
          'items.ingredientProduct',
          'items.unit',
          'yieldUnit',
        ],
      });
    });
  }

  async activateRecipe(actor: Actor, id: string) {
    const recipe = await this.recipes.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    this.resolveBranch(actor, recipe.branchId);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        KitchenRecipe,
        {
          branchId: recipe.branchId,
          productId: recipe.productId,
          status: 'ACTIVE',
        },
        { status: 'INACTIVE', updatedBy: actor.userId },
      );
      await manager.update(KitchenRecipe, id, {
        status: 'ACTIVE',
        effectiveFrom: new Date(),
        updatedBy: actor.userId,
      });
    });
    return this.recipes.findOne({
      where: { id },
      relations: ['items', 'items.unit'],
    });
  }

  async deleteDraftRecipe(actor: Actor, id: string) {
    const recipe = await this.recipes.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    this.resolveBranch(actor, recipe.branchId);
    if (recipe.status !== 'DRAFT')
      throw new BadRequestException('ACTIVE_RECIPE_IS_IMMUTABLE');
    await this.recipes.remove(recipe);
    return { deleted: true };
  }

  async listPeriods(actor: Actor, branchId?: string) {
    return this.periods.find({
      where: { branchId: this.resolveBranch(actor, branchId) },
      order: { startTime: 'ASC' },
    });
  }

  async upsertPeriod(actor: Actor, dto: any) {
    const branchId = this.resolveBranch(actor, dto.branchId);
    if (!MEAL_PERIOD_VALUES.includes(dto.mealPeriod))
      throw new BadRequestException('INVALID_MEAL_PERIOD');
    let period = await this.periods.findOne({
      where: { branchId, mealPeriod: dto.mealPeriod },
    });
    period =
      period ||
      this.periods.create({
        branchId,
        mealPeriod: dto.mealPeriod,
        createdBy: actor.userId,
      });
    Object.assign(period, dto, {
      branchId,
      timezone: dto.timezone || 'Asia/Bangkok',
      updatedBy: actor.userId,
    });
    return this.periods.save(period);
  }

  async createTicketInTransaction(manager: EntityManager, orderId: string) {
    if (!this.isEnabled()) return null;
    const existing = await manager.findOne(KitchenOrderTicket, {
      where: { orderId },
    });
    if (existing) return existing;
    const order = await manager.findOne(Order, {
      where: { id: orderId },
      relations: ['items', 'customer'],
    });
    if (
      !order ||
      order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID ||
      !order.branchId
    )
      return null;
    const firstProductId = order.items?.[0]?.productId;
    const mapping = firstProductId
      ? await manager.findOne(KitchenProductStation, {
          where: { branchId: order.branchId, productId: firstProductId },
        })
      : null;
    const saved = await manager.save(
      KitchenOrderTicket,
      manager.create(KitchenOrderTicket, {
        orderId,
        branchId: order.branchId,
        stationId: mapping?.stationId || null,
        status: KITCHEN_TICKET_STATUS.WAITING,
      }),
    );
    await manager.save(
      KitchenOrderTicketItem,
      (order.items || []).map((item: any) =>
        manager.create(KitchenOrderTicketItem, {
          ticketId: saved.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          note: item.note,
        }),
      ),
    );
    return saved;
  }

  async createTicketForPaidOrder(orderId: string, emitExisting = false) {
    if (!this.isEnabled()) return null;
    const existing = await this.tickets.findOne({
      where: { orderId },
      relations: ['items', 'order', 'station'],
    });
    if (existing) {
      if (emitExisting) this.socketService.emitKitchenTicketCreated(existing);
      return existing;
    }
    try {
      const ticket = await this.dataSource.transaction(async (manager) => {
        const saved = await this.createTicketInTransaction(manager, orderId);
        return saved
          ? manager.findOne(KitchenOrderTicket, {
              where: { id: saved.id },
              relations: ['items', 'order', 'station'],
            })
          : null;
      });
      if (ticket) this.socketService.emitKitchenTicketCreated(ticket);
      return ticket;
    } catch (error: any) {
      if (error?.code === '23505')
        return this.tickets.findOne({
          where: { orderId },
          relations: ['items', 'order', 'station'],
        });
      throw error;
    }
  }

  async reconcilePaidTickets() {
    if (!this.isEnabled()) return { created: 0 };
    const activation =
      this.config.get('KITCHEN_ACTIVATED_AT') || this.activatedAt;
    const rows = await this.dataSource.query(
      `SELECT o.id FROM orders o LEFT JOIN kitchen_order_tickets kt ON kt.order_id=o.id WHERE o.payment_status=$1 AND kt.id IS NULL AND o.created_at >= $2`,
      [ORDER_PAYMENT_STATUS.PAID, activation],
    );
    let created = 0;
    for (const row of rows)
      if (await this.createTicketForPaidOrder(row.id)) created++;
    return { created };
  }

  async listTickets(actor: Actor, query: any) {
    const pagination = normalizePagination(query.page, query.size);
    const qb = this.tickets
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.items', 'items')
      .leftJoinAndSelect('ticket.order', 'order')
      .leftJoinAndSelect('ticket.station', 'station')
      .where('ticket.branchId = :branchId', {
        branchId: this.resolveBranch(actor, query.branchId),
      })
      .orderBy('ticket.createdAt', 'ASC')
      .skip(pagination.skip)
      .take(pagination.size);
    if (query.status)
      qb.andWhere('ticket.status = :status', { status: query.status });
    if (query.stationId)
      qb.andWhere('ticket.stationId = :stationId', {
        stationId: query.stationId,
      });
    if (query.from)
      qb.andWhere('ticket.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('ticket.createdAt <= :to', { to: query.to });
    const [data, total] = await qb.getManyAndCount();
    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async getTicket(actor: Actor, id: string) {
    const ticket = await this.tickets.findOne({
      where: { id },
      relations: ['items', 'order', 'station'],
    });
    if (!ticket) throw new NotFoundException('Kitchen ticket not found');
    this.resolveBranch(actor, ticket.branchId);
    return ticket;
  }

  async transitionTicket(
    actor: Actor,
    id: string,
    expectedVersion: number,
    target: string,
  ) {
    const ticket = await this.getTicket(actor, id);
    const allowed: Record<string, string> = {
      [KITCHEN_TICKET_STATUS.WAITING]: KITCHEN_TICKET_STATUS.PREPARING,
      [KITCHEN_TICKET_STATUS.PREPARING]: KITCHEN_TICKET_STATUS.READY,
    };
    try {
      assertKitchenTransition(ticket.status, target, allowed);
    } catch {
      throw new BadRequestException('INVALID_KITCHEN_TICKET_TRANSITION');
    }
    const patch: any = {
      status: target,
      updatedBy: actor.userId,
      updatedAt: new Date(),
    };
    if (target === KITCHEN_TICKET_STATUS.PREPARING)
      patch.startedAt = new Date();
    if (target === KITCHEN_TICKET_STATUS.READY) patch.readyAt = new Date();
    const result = await this.tickets
      .createQueryBuilder()
      .update()
      .set(patch)
      .where('id = :id AND version = :version', {
        id,
        version: expectedVersion,
      })
      .execute();
    if (!result.affected)
      throw new ConflictException('KITCHEN_TICKET_VERSION_CONFLICT');
    if (target === KITCHEN_TICKET_STATUS.READY) {
      const order = await this.dataSource
        .getRepository(Order)
        .findOne({ where: { id: ticket.orderId } });
      if (order) {
        await this.dataSource.transaction(async (manager) => {
          await manager.update(Order, order.id, {
            status: ORDER_STATUS.READY_TO_PICKUP,
            updatedBy: actor.userId,
          });
          await manager.save(
            OrderStatusLog,
            manager.create(OrderStatusLog, {
              orderId: order.id,
              oldStatus: order.status,
              newStatus: ORDER_STATUS.READY_TO_PICKUP,
              changedBy: actor.userId,
              reason: 'KITCHEN_READY',
              createdBy: actor.userId,
            }),
          );
        });
        const updatedOrder = await this.dataSource
          .getRepository(Order)
          .findOne({
            where: { id: order.id },
            relations: ['items', 'customer'],
          });
        this.socketService.emitOrderReadyToPickup(updatedOrder);
        this.socketService.emitOrderStatusChanged(updatedOrder);
      }
    }
    const updated = await this.getTicket(actor, id);
    this.socketService.emitKitchenTicketUpdated(updated);
    return updated;
  }

  async markDelivered(orderId: string, changedBy?: string) {
    if (!this.isEnabled()) return;
    const ticket = await this.tickets.findOne({ where: { orderId } });
    if (!ticket || ticket.status === KITCHEN_TICKET_STATUS.DELIVERED) return;
    ticket.status = KITCHEN_TICKET_STATUS.DELIVERED;
    ticket.deliveredAt = new Date();
    ticket.updatedBy = changedBy;
    const updated = await this.tickets.save(ticket);
    this.socketService.emitKitchenTicketUpdated(
      await this.tickets.findOne({
        where: { id: updated.id },
        relations: ['items', 'order', 'station'],
      }),
    );
  }

  hasTicket(orderId: string) {
    return this.isEnabled()
      ? this.tickets.exist({ where: { orderId } })
      : Promise.resolve(false);
  }

  async orderForLegacyStockExport(order: any) {
    const recipeStockEnabled =
      String(
        this.config.get('KITCHEN_RECIPE_STOCK_ENABLED') ?? 'false',
      ).toLowerCase() === 'true';
    if (!this.isEnabled() || !recipeStockEnabled || !order?.branchId)
      return order;
    const productIds = (order.items || []).map((item: any) => item.productId);
    if (!productIds.length) return order;
    const recipeRows = await this.recipes.find({
      where: {
        branchId: order.branchId,
        productId: In(productIds),
        status: 'ACTIVE',
      },
    });
    const recipeProducts = new Set(recipeRows.map((row) => row.productId));
    return {
      ...order,
      items: (order.items || []).filter(
        (item: any) => !recipeProducts.has(item.productId),
      ),
    };
  }

  async getMealPlans(actor: Actor, query: any) {
    return this.mealPlans.find({
      where: {
        branchId: this.resolveBranch(actor, query.branchId),
        ...(query.date ? { planDate: query.date } : {}),
        ...(query.mealPeriod ? { mealPeriod: query.mealPeriod } : {}),
      },
      relations: ['batches', 'batches.mealItem'],
      order: { planDate: 'DESC' },
    });
  }

  async createMealPlan(actor: Actor, dto: any) {
    const branchId = this.resolveBranch(actor, dto.branchId);
    if (!dto.date || !MEAL_PERIOD_VALUES.includes(dto.mealPeriod)) {
      throw new BadRequestException('date and valid mealPeriod are required');
    }
    return this.ensureMealPlan(branchId, dto.date, dto.mealPeriod);
  }

  async lockMealPlan(actor: Actor, planId: string) {
    const plan = await this.mealPlans.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Kitchen meal plan not found');
    this.resolveBranch(actor, plan.branchId);
    if (plan.status === 'LOCKED')
      return this.getMealPlans(actor, {
        branchId: plan.branchId,
        date: plan.planDate,
        mealPeriod: plan.mealPeriod,
      }).then((rows) => rows[0]);
    const date = new Date(`${plan.planDate}T00:00:00+07:00`);
    const weekday = date.getDay();
    const items = await this.mealItems
      .createQueryBuilder('mi')
      .leftJoin(
        KitchenProductStation,
        'ps',
        'ps.product_id=mi.product_id AND ps.branch_id=mi.branch_id',
      )
      .select([
        'mi.id AS "id"',
        'mi.product_id AS "productId"',
        'mi.expected_quantity AS "expectedQuantity"',
        'ps.station_id AS "stationId"',
      ])
      .where('mi.branch_id=:branchId', { branchId: plan.branchId })
      .andWhere('mi.meal_period=:mealPeriod', { mealPeriod: plan.mealPeriod })
      .andWhere('mi.status=:status', { status: COMMON_STATUS.ACTIVE })
      .andWhere(
        '(mi.date_key=:date OR (mi.date_key IS NULL AND mi.day_of_week=:weekday))',
        { date: plan.planDate, weekday },
      )
      .getRawMany();
    await this.dataSource.transaction(async (manager) => {
      for (const item of items) {
        const count = await manager
          .getRepository(CustomerMealItem)
          .createQueryBuilder('cmi')
          .where('cmi.meal_item_id=:mealItemId', { mealItemId: item.id })
          .andWhere('cmi.status=:status', { status: COMMON_STATUS.ACTIVE })
          .select('COALESCE(SUM(cmi.quantity),0)', 'quantity')
          .getRawOne();
        await manager.getRepository(KitchenProductionBatch).upsert(
          {
            mealPlanId: plan.id,
            mealItemId: item.id,
            productId: item.productId,
            stationId: item.stationId || null,
            plannedQuantity: Number(
              count?.quantity || item.expectedQuantity || 0,
            ),
            adjustmentQuantity: 0,
            status: KITCHEN_BATCH_STATUS.WAITING,
            createdBy: actor.userId,
          },
          ['mealPlanId', 'mealItemId'],
        );
      }
      await manager.update(KitchenMealPlan, plan.id, {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedBy: actor.userId,
        updatedBy: actor.userId,
      });
    });
    const updated = (
      await this.getMealPlans(actor, {
        branchId: plan.branchId,
        date: plan.planDate,
        mealPeriod: plan.mealPeriod,
      })
    )[0];
    this.socketService.emitKitchenMealPlanLocked(updated);
    return updated;
  }

  async ensureMealPlan(branchId: string, date: string, mealPeriod: string) {
    let plan = await this.mealPlans.findOne({
      where: { branchId, planDate: date, mealPeriod },
    });
    if (!plan) {
      await this.mealPlans.upsert(
        { branchId, planDate: date, mealPeriod, status: 'DRAFT' },
        ['branchId', 'planDate', 'mealPeriod'],
      );
      plan = await this.mealPlans.findOneOrFail({
        where: { branchId, planDate: date, mealPeriod },
      });
    }
    return plan;
  }

  async lockDuePlans() {
    if (!this.isEnabled()) return;
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const due = await this.periods
      .createQueryBuilder('p')
      .where('p.isActive=true')
      .andWhere("to_char(p.cutoffTime, 'HH24:MI') <= :time", { time })
      .getMany();
    for (const period of due) {
      const plan = await this.ensureMealPlan(
        period.branchId,
        date,
        period.mealPeriod,
      );
      if (plan.status !== 'LOCKED')
        await this.lockMealPlan(
          {
            userId: 'system',
            userType: USER_ROLE.ADMIN,
            branchId: period.branchId,
          },
          plan.id,
        );
    }
  }

  async adjustBatch(actor: Actor, planId: string, dto: any) {
    const batch = await this.batches.findOne({
      where: { id: dto.batchId, mealPlanId: planId },
      relations: ['mealPlan'],
    });
    if (!batch) throw new NotFoundException('Kitchen batch not found');
    this.resolveBranch(actor, batch.mealPlan.branchId);
    if (!Number.isInteger(dto.quantity) || !String(dto.reason || '').trim())
      throw new BadRequestException(
        'Adjustment quantity and reason are required',
      );
    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        KitchenBatchAdjustment,
        manager.create(KitchenBatchAdjustment, {
          batchId: batch.id,
          quantity: dto.quantity,
          reason: dto.reason.trim(),
          changedBy: actor.userId,
          createdBy: actor.userId,
        }),
      );
      await manager.increment(
        KitchenProductionBatch,
        { id: batch.id },
        'adjustmentQuantity',
        dto.quantity,
      );
    });
    return this.batches.findOne({ where: { id: batch.id } });
  }

  async listBatchAdjustments(actor: Actor, batchId: string) {
    const batch = await this.batches.findOne({
      where: { id: batchId },
      relations: ['mealPlan'],
    });
    if (!batch) throw new NotFoundException('Kitchen batch not found');
    this.resolveBranch(actor, batch.mealPlan.branchId);
    return this.adjustments.find({
      where: { batchId },
      order: { createdAt: 'DESC' },
    });
  }

  async transitionBatch(
    actor: Actor,
    id: string,
    expectedVersion: number,
    target: string,
  ) {
    const batch = await this.batches.findOne({
      where: { id },
      relations: ['mealPlan'],
    });
    if (!batch) throw new NotFoundException('Kitchen batch not found');
    this.resolveBranch(actor, batch.mealPlan.branchId);
    const allowed: Record<string, string> = {
      WAITING: 'PREPARING',
      PREPARING: 'READY',
      READY: 'COMPLETED',
    };
    try {
      assertKitchenTransition(batch.status, target, allowed);
    } catch {
      throw new BadRequestException('INVALID_KITCHEN_BATCH_TRANSITION');
    }
    const patch: any = {
      status: target,
      updatedBy: actor.userId,
      updatedAt: new Date(),
    };
    if (target === 'PREPARING') patch.startedAt = new Date();
    if (target === 'READY') patch.readyAt = new Date();
    if (target === 'COMPLETED') patch.completedAt = new Date();
    const result = await this.batches
      .createQueryBuilder()
      .update()
      .set(patch)
      .where('id=:id AND version=:version', { id, version: expectedVersion })
      .execute();
    if (!result.affected)
      throw new ConflictException('KITCHEN_BATCH_VERSION_CONFLICT');
    const updated = await this.batches.findOne({
      where: { id },
      relations: ['mealItem'],
    });
    this.socketService.emitKitchenBatchUpdated(
      batch.mealPlan.branchId,
      updated,
    );
    return updated;
  }

  private async calculateDemand(
    branchId: string,
    date: string,
    mealPeriod: string,
    stationId?: string,
  ) {
    const productQuantities = new Map<string, number>();
    const plans = await this.mealPlans.find({
      where: { branchId, planDate: date, mealPeriod },
      relations: ['batches'],
    });
    for (const plan of plans)
      for (const batch of plan.batches || [])
        if (!stationId || batch.stationId === stationId)
          productQuantities.set(
            batch.productId,
            (productQuantities.get(batch.productId) || 0) +
              batch.plannedQuantity +
              batch.adjustmentQuantity,
          );
    const ticketRows = await this.tickets
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.items', 'i')
      .where('t.branch_id=:branchId', { branchId })
      .andWhere('DATE(t.created_at)=:date', { date })
      .andWhere('t.status IN (:...statuses)', {
        statuses: ['WAITING', 'PREPARING', 'READY', 'DELIVERED'],
      })
      .andWhere(stationId ? 't.station_id=:stationId' : '1=1', { stationId })
      .getMany();
    for (const ticket of ticketRows)
      for (const item of ticket.items || [])
        productQuantities.set(
          item.productId,
          (productQuantities.get(item.productId) || 0) + item.quantity,
        );
    const result = new Map<
      string,
      { productId: string; quantity: number; unitId: string }
    >();
    for (const [productId, servings] of productQuantities) {
      const recipe = await this.recipes.findOne({
        where: { branchId, productId, status: 'ACTIVE' },
        relations: ['items', 'items.unit', 'items.ingredientProduct'],
      });
      if (!recipe) continue;
      for (const item of recipe.items) {
        const baseUnit = item.ingredientProduct.baseUnitId
          ? await this.units.findOne({
              where: { id: item.ingredientProduct.baseUnitId },
            })
          : null;
        if (!baseUnit) continue;
        const quantity = calculateRecipeRequirement(
          Number(item.quantity),
          item.unit,
          baseUnit,
          servings,
          Number(recipe.yieldQuantity),
        );
        const current = result.get(item.ingredientProductId);
        result.set(item.ingredientProductId, {
          productId: item.ingredientProductId,
          quantity: (current?.quantity || 0) + quantity,
          unitId: baseUnit.id,
        });
      }
    }
    return [...result.values()];
  }

  async getDemand(actor: Actor, query: any) {
    const branchId = this.resolveBranch(actor, query.branchId);
    const demand = await this.calculateDemand(
      branchId,
      query.date,
      query.mealPeriod,
      query.stationId,
    );
    const stockRows = await this.dataSource
      .getRepository(StockItem)
      .createQueryBuilder('si')
      .innerJoin(Stock, 's', 's.id=si.stock_id')
      .select('si.product_id', 'productId')
      .addSelect('SUM(si.quantity)', 'quantity')
      .where('s.branch_id=:branchId', { branchId })
      .groupBy('si.product_id')
      .getRawMany();
    const stock = new Map(
      stockRows.map((row: any) => [row.productId, Number(row.quantity)]),
    );
    return demand.map((line) => ({
      ...line,
      availableQuantity: stock.get(line.productId) || 0,
      shortageQuantity: Math.max(
        0,
        line.quantity - (stock.get(line.productId) || 0),
      ),
    }));
  }

  async createConsumptionSession(actor: Actor, dto: any) {
    const branchId = this.resolveBranch(actor, dto.branchId);
    const station = await this.stations.findOne({
      where: { id: dto.stationId, branchId },
    });
    if (!station) throw new NotFoundException('Kitchen station not found');
    let session = await this.sessions.findOne({
      where: {
        branchId,
        sessionDate: dto.date,
        mealPeriod: dto.mealPeriod,
        stationId: dto.stationId,
      },
      relations: ['lines'],
    });
    if (session) return session;
    const demand = await this.calculateDemand(
      branchId,
      dto.date,
      dto.mealPeriod,
      dto.stationId,
    );
    session = await this.sessions.save(
      this.sessions.create({
        branchId,
        sessionDate: dto.date,
        mealPeriod: dto.mealPeriod,
        stationId: dto.stationId,
        status: 'DRAFT',
        createdBy: actor.userId,
      }),
    );
    await this.dataSource.getRepository(KitchenConsumptionLine).save(
      demand.map((line) =>
        this.dataSource.getRepository(KitchenConsumptionLine).create({
          sessionId: session.id,
          productId: line.productId,
          expectedQuantity: line.quantity,
          actualQuantity: line.quantity,
          unitId: line.unitId,
          createdBy: actor.userId,
        }),
      ),
    );
    return this.sessions.findOne({
      where: { id: session.id },
      relations: ['lines'],
    });
  }

  async listConsumptionSessions(actor: Actor, query: any) {
    return this.sessions.find({
      where: {
        branchId: this.resolveBranch(actor, query.branchId),
        ...(query.date ? { sessionDate: query.date } : {}),
        ...(query.mealPeriod ? { mealPeriod: query.mealPeriod } : {}),
        ...(query.stationId ? { stationId: query.stationId } : {}),
      },
      relations: ['lines'],
      order: { sessionDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async getConsumptionSession(actor: Actor, id: string) {
    const session = await this.sessions.findOne({
      where: { id },
      relations: ['lines'],
    });
    if (!session)
      throw new NotFoundException('Kitchen consumption session not found');
    this.resolveBranch(actor, session.branchId);
    return session;
  }

  async confirmConsumption(actor: Actor, id: string, dto: any) {
    const session = await this.sessions.findOne({
      where: { id },
      relations: ['lines'],
    });
    if (!session)
      throw new NotFoundException('Kitchen consumption session not found');
    this.resolveBranch(actor, session.branchId);
    if (session.status === 'CONFIRMED') return session;
    const suppliedLines = dto.lines || [];
    const suppliedIds = suppliedLines.map((line: any) => line.productId);
    if (new Set(suppliedIds).size !== suppliedIds.length)
      throw new BadRequestException('DUPLICATE_CONSUMPTION_PRODUCT');
    if (
      suppliedIds.some(
        (productId: string) =>
          !session.lines.some((line) => line.productId === productId),
      )
    )
      throw new BadRequestException('UNKNOWN_CONSUMPTION_PRODUCT');
    const actualMap = new Map(
      suppliedLines.map((line: any) => [
        line.productId,
        Number(line.actualQuantity),
      ]),
    );
    let confirmed: KitchenConsumptionSession;
    try {
      confirmed = await this.dataSource.transaction(async (manager) => {
        const locked = await manager
          .getRepository(KitchenConsumptionSession)
          .createQueryBuilder('s')
          .setLock('pessimistic_write')
          .where('s.id=:id', { id })
          .getOneOrFail();
        if (locked.status === 'CONFIRMED') return locked;
        const stock = await manager
          .getRepository(Stock)
          .findOne({ where: { branchId: session.branchId } });
        if (!stock) throw new BadRequestException('BRANCH_STOCK_NOT_FOUND');
        const stockItems = await manager
          .getRepository(StockItem)
          .createQueryBuilder('si')
          .setLock('pessimistic_write')
          .where('si.stock_id=:stockId', { stockId: stock.id })
          .andWhere('si.product_id IN (:...ids)', {
            ids: session.lines.map((line) => line.productId),
          })
          .getMany();
        const byProduct = new Map(
          stockItems.map((row) => [row.productId, row]),
        );
        const shortages: any[] = [];
        for (const line of session.lines) {
          const actual = actualMap.has(line.productId)
            ? Number(actualMap.get(line.productId))
            : Number(line.actualQuantity);
          if (!(actual >= 0))
            throw new BadRequestException('INVALID_ACTUAL_QUANTITY');
          const available = Number(
            byProduct.get(line.productId)?.quantity || 0,
          );
          if (actual > available)
            shortages.push({
              productId: line.productId,
              requiredQuantity: actual,
              availableQuantity: available,
              shortageQuantity: actual - available,
            });
        }
        if (shortages.length)
          throw new ConflictException({
            code: 'KITCHEN_STOCK_SHORTAGE',
            shortages,
          });
        const receipt = await manager.save(
          StockReceiptExport,
          manager.create(StockReceiptExport, {
            code: `XKB${Date.now()}${session.id.slice(0, 6)}`,
            branchId: session.branchId,
            referenceId: session.id,
            referenceType: 'kitchen_consumption_session',
            status: 'COMPLETED',
            totalAmount: 0,
            note: `Kitchen consumption ${session.sessionDate} ${session.mealPeriod}`,
          }),
        );
        for (const line of session.lines) {
          const actual = actualMap.has(line.productId)
            ? Number(actualMap.get(line.productId))
            : Number(line.actualQuantity);
          await manager.update(KitchenConsumptionLine, line.id, {
            actualQuantity: actual,
            updatedBy: actor.userId,
          });
          const stockItem = byProduct.get(line.productId)!;
          stockItem.quantity = Number(stockItem.quantity) - actual;
          await manager.save(StockItem, stockItem);
          await manager.save(
            StockReceiptDetail,
            manager.create(StockReceiptDetail, {
              productId: line.productId,
              quantity: actual,
              receiptType: 'EXPORT',
              fromId: session.branchId,
              fromType: 'BRANCH',
              toId: session.id,
              toType: 'KITCHEN',
              exportId: receipt.id,
            }),
          );
        }
        locked.status = 'CONFIRMED';
        locked.stockExportId = receipt.id;
        locked.confirmedAt = new Date();
        locked.updatedBy = actor.userId;
        return manager.save(KitchenConsumptionSession, locked);
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        const response = error.getResponse() as any;
        if (response?.code === 'KITCHEN_STOCK_SHORTAGE') {
          const shortageRepository =
            this.dataSource.getRepository(KitchenStockShortage);
          await shortageRepository.save(
            response.shortages.map((shortage: any) =>
              shortageRepository.create({
                sessionId: session.id,
                branchId: session.branchId,
                ...shortage,
                createdBy: actor.userId,
              }),
            ),
          );
        }
      }
      throw error;
    }
    this.socketService.emitKitchenConsumptionUpdated(
      session.branchId,
      confirmed,
    );
    return this.sessions.findOne({ where: { id }, relations: ['lines'] });
  }

  async listAssignments(actor: Actor, query: any) {
    return this.assignments.find({
      where: {
        branchId: this.resolveBranch(actor, query.branchId),
        ...(query.date ? { workDate: query.date } : {}),
        ...(query.stationId ? { stationId: query.stationId } : {}),
      },
      relations: ['employee', 'station'],
      order: { workDate: 'DESC' },
    });
  }

  async createAssignment(actor: Actor, dto: any) {
    const branchId = this.resolveBranch(actor, dto.branchId);
    const [employee, station, schedule] = await Promise.all([
      this.employees.findOne({
        where: { id: dto.employeeId, branchId, status: 'working' },
      }),
      this.stations.findOne({ where: { id: dto.stationId, branchId } }),
      this.workSchedules.findOne({
        where: { employeeId: dto.employeeId, workDate: dto.workDate },
      }),
    ]);
    if (!employee || !station)
      throw new BadRequestException('ASSIGNMENT_BRANCH_MISMATCH');
    if (!schedule) throw new BadRequestException('EMPLOYEE_NOT_SCHEDULED');
    return this.assignments.save(
      this.assignments.create({
        ...dto,
        branchId,
        shift: dto.shift || schedule.shift,
        status: 'ACTIVE',
        createdBy: actor.userId,
      }),
    );
  }

  async updateAssignment(actor: Actor, id: string, dto: any) {
    const row = await this.assignments.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Kitchen assignment not found');
    this.resolveBranch(actor, row.branchId);
    Object.assign(row, dto, {
      branchId: row.branchId,
      updatedBy: actor.userId,
    });
    return this.assignments.save(row);
  }

  async cancelAssignment(actor: Actor, id: string) {
    return this.updateAssignment(actor, id, { status: 'CANCELLED' });
  }

  async operationsReport(actor: Actor, query: any) {
    const branchId = this.resolveBranch(actor, query.branchId);
    const params = [branchId, query.from, query.to];
    const [
      ticketCounts,
      batchCounts,
      timings,
      mealTotals,
      consumption,
      shortages,
    ] = await Promise.all([
      this.dataSource.query(
        `SELECT status, COUNT(*)::int count FROM kitchen_order_tickets WHERE branch_id=$1 AND created_at::date BETWEEN $2::date AND $3::date GROUP BY status`,
        params,
      ),
      this.dataSource.query(
        `SELECT b.status, COUNT(*)::int count FROM kitchen_production_batches b JOIN kitchen_meal_plans p ON p.id=b.meal_plan_id WHERE p.branch_id=$1 AND p.plan_date BETWEEN $2::date AND $3::date GROUP BY b.status`,
        params,
      ),
      this.dataSource.query(
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (started_at-created_at))/60),0) "averageWaitMinutes", COALESCE(AVG(EXTRACT(EPOCH FROM (ready_at-started_at))/60),0) "averagePreparationMinutes", COALESCE(AVG(CASE WHEN ready_at IS NOT NULL AND ready_at <= created_at + make_interval(mins => $4::int) THEN 1 ELSE 0 END),0) "onTimeRate" FROM kitchen_order_tickets WHERE branch_id=$1 AND created_at::date BETWEEN $2::date AND $3::date`,
        [
          ...params,
          Number(this.config.get('KITCHEN_TICKET_SLA_MINUTES') || 15),
        ],
      ),
      this.dataSource.query(
        `SELECT COALESCE(SUM(b.planned_quantity),0) "plannedQuantity", COALESCE(SUM(b.adjustment_quantity),0) "adjustmentQuantity", COALESCE(SUM(CASE WHEN b.status='COMPLETED' THEN b.planned_quantity+b.adjustment_quantity ELSE 0 END),0) "actualQuantity" FROM kitchen_production_batches b JOIN kitchen_meal_plans p ON p.id=b.meal_plan_id WHERE p.branch_id=$1 AND p.plan_date BETWEEN $2::date AND $3::date`,
        params,
      ),
      this.dataSource.query(
        `SELECT COALESCE(SUM(l.expected_quantity),0) "expectedQuantity", COALESCE(SUM(l.actual_quantity),0) "actualQuantity" FROM kitchen_consumption_lines l JOIN kitchen_consumption_sessions s ON s.id=l.session_id WHERE s.branch_id=$1 AND s.session_date BETWEEN $2::date AND $3::date AND s.status='CONFIRMED'`,
        params,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int count, COALESCE(SUM(shortage_quantity),0) "shortageQuantity" FROM kitchen_stock_shortages WHERE branch_id=$1 AND created_at::date BETWEEN $2::date AND $3::date`,
        params,
      ),
    ]);
    return {
      ticketCounts,
      batchCounts,
      timings: timings[0],
      mealTotals: mealTotals[0],
      consumption: consumption[0],
      shortages: shortages[0],
    };
  }
}
