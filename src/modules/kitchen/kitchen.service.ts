import { isUUID } from 'class-validator';
import { recipeCosting } from './recipe-costing';
import { KitchenOperationsService } from './kitchen-operations.service';
import { canUseStockProduct } from '../stock/stock-scope';
import {
  StockMovementService,
  localDate,
} from '../stock/stock-movement.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  CustomerMealItem,
  Employee,
  KitchenAssignment,
  KitchenBatchAdjustment,
  KitchenConsumptionLine,
  KitchenConsumptionSession,
  KitchenMealPlan,
  KitchenOperation,
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
    private movements: StockMovementService,
    private operations: KitchenOperationsService,
  ) {}

  resolveBranch(actor: Actor, requested?: string) {
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
      ![USER_ROLE.KITCHEN, USER_ROLE.HEAD_CHEF, USER_ROLE.CASHIER].includes(
        user.role as any,
      ) ||
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
    if (!(await canUseStockProduct(this.dataSource.manager, product, branchId)))
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
    const editor = ['ADMIN', 'MANAGER', 'HEAD_CHEF'].includes(actor.userType);
    if (!editor) where.status = 'ACTIVE';
    const rows = await this.recipes.find({
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
    const canViewCost = ['ADMIN', 'MANAGER'].includes(actor.userType);
    const units = canViewCost ? await this.units.find() : [];
    return rows.map((row) => ({
      ...row,
      ...(canViewCost
        ? {
            costing: ['DRAFT', 'REVISION_REQUESTED'].includes(row.status) ||
              (row.status === 'PENDING_REVIEW' && !row.approval?.costing?.complete)
              ? recipeCosting(row, units)
              : row.approval?.costing || recipeCosting(row, units),
          }
        : {}),
    }));
  }

  async listRecipeRequests(actor: Actor, query: any) {
    if (!['HEAD_CHEF', 'ADMIN', 'MANAGER'].includes(actor.userType))
      throw new ForbiddenException('Bạn không có quyền xem yêu cầu công thức.');
    const branchId = this.resolveBranch(actor, query.branchId);
    const where: any = { branchId, kind: 'recipe-request' };
    if (query.productId) {
      if (!isUUID(query.productId))
        throw new BadRequestException('Mã món không hợp lệ.');
      where.parentId = query.productId;
    }
    const rows = await this.dataSource
      .getRepository(KitchenOperation)
      .find({ where, order: { createdAt: 'DESC' } });
    return rows.map((row) => ({
      id: row.id,
      productId: row.parentId,
      status: row.status,
      productName: row.payload.productName,
      note: row.payload.note,
      requestedByName: row.payload.requestedByName,
      createdAt: row.createdAt,
      recipeId: row.payload.recipeId || null,
      link: `/dashboard/menu/recipes?productId=${row.parentId}`,
    }));
  }

  async listRecipeNotifications(actor: Actor) {
    if (!['ADMIN', 'MANAGER'].includes(actor.userType))
      throw new ForbiddenException('Bạn không có quyền xem thông báo công thức.');
    const query = this.dataSource.getRepository(KitchenOperation)
      .createQueryBuilder('request')
      .where('request.kind = :kind', { kind: 'recipe-request' })
      .andWhere('request.status = :status', { status: 'SUBMITTED' })
      .andWhere('request.created_by = :userId', { userId: actor.userId });
    if (actor.userType !== 'ADMIN')
      query.andWhere('request.branch_id = :branchId', {
        branchId: this.resolveBranch(actor),
      });
    const [rows, unreadCount] = await Promise.all([
      query.clone().orderBy("request.payload->>'submittedAt'", 'DESC')
        .addOrderBy('request.id', 'DESC').take(50).getMany(),
      query.clone().andWhere("request.payload->>'requesterReadAt' IS NULL").getCount(),
    ]);
    return {
      unreadCount,
      items: rows.map((row) => ({
        id: row.id,
        productId: row.parentId,
        productName: row.payload.productName,
        branchId: row.branchId,
        recipeId: row.payload.recipeId,
        title: 'Bếp đã hoàn tất công thức',
        message: `Công thức và định lượng món ${row.payload.productName} đã được bếp trưởng hoàn tất và gửi duyệt.`,
        createdAt: row.payload.submittedAt,
        isRead: Boolean(row.payload.requesterReadAt),
      })),
    };
  }

  async readRecipeNotification(actor: Actor, id: string) {
    if (!['ADMIN', 'MANAGER'].includes(actor.userType))
      throw new ForbiddenException('Bạn không có quyền đọc thông báo công thức.');
    if (!isUUID(id)) throw new BadRequestException('Mã thông báo không hợp lệ.');
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(KitchenOperation);
      const row = await repo.findOne({
        where: { id, kind: 'recipe-request', status: 'SUBMITTED', createdBy: actor.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Không tìm thấy thông báo.');
      this.resolveBranch(actor, row.branchId);
      if (!row.payload.requesterReadAt) {
        row.payload = { ...row.payload, requesterReadAt: new Date().toISOString() };
        row.updatedBy = actor.userId;
        await repo.save(row);
      }
      return { id: row.id, isRead: true };
    });
  }

  async requestRecipe(actor: Actor, productId: string, dto: any) {
    if (!isUUID(productId))
      throw new BadRequestException('Mã món không hợp lệ.');
    if (!['ADMIN', 'MANAGER'].includes(actor.userType))
      throw new ForbiddenException(
        'Chỉ admin hoặc quản lý chi nhánh được yêu cầu tạo công thức.',
      );
    const branchId = this.resolveBranch(actor, dto.branchId);
    if (
      dto.note != null &&
      (typeof dto.note !== 'string' || dto.note.trim().length > 1000)
    )
      throw new BadRequestException('Nội dung yêu cầu tối đa 1000 ký tự.');
    return this.dataSource.transaction(async (manager) => {
      await this.operations.lock(manager, branchId);
      const product = await manager
        .getRepository(Product)
        .findOneBy({ id: productId });
      if (
        !product ||
        product.productType !== 'FINISHED_GOOD' ||
        !(await canUseStockProduct(manager, product, branchId))
      )
        throw new BadRequestException(
          'Món không thuộc chi nhánh hoặc không phải thành phẩm.',
        );
      const repo = manager.getRepository(KitchenOperation);
      const existing = await repo.findOne({
        where: {
          branchId,
          kind: 'recipe-request',
          parentId: productId,
          status: 'OPEN',
        },
      });
      if (existing)
        return {
          id: existing.id,
          alreadyRequested: true,
          status: existing.status,
        };
      const recipe = await manager
        .getRepository(KitchenRecipe)
        .findOneBy({ branchId, productId });
      if (recipe)
        throw new ConflictException(
          'Món đã có công thức. Hãy xem công thức hoặc yêu cầu chỉnh sửa bản đang chờ duyệt.',
        );
      // Staff notifications are branch kitchen documents; customer notifications
      // belong to a different audience and must not be reused for employees.
      const chefs = await manager.query(
        `SELECT u.id FROM users u JOIN employees e ON e.user_id=u.id AND e.branch_id=u.branch_id
        WHERE u.branch_id=$1 AND u.role='HEAD_CHEF' AND u.status='ACTIVE' AND e.status='working'`,
        [branchId],
      );
      if (!chefs.length)
        throw new ConflictException(
          'Chi nhánh chưa có tài khoản bếp trưởng hoạt động để nhận yêu cầu.',
        );
      const requester = await manager
        .getRepository(User)
        .findOneBy({ id: actor.userId });
      const row = await repo.save(
        repo.create({
          branchId,
          kind: 'recipe-request',
          parentId: productId,
          requestId: null,
          date: localDate(),
          shift: '',
          status: 'OPEN',
          createdBy: actor.userId,
          payload: {
            productName: product.name,
            note:
              dto.note?.trim() ||
              `Vui lòng tạo công thức và định lượng cho món ${product.name}, sau đó gửi duyệt.`,
            requestedByName: requester?.fullName || 'Quản trị',
            recipientRole: 'HEAD_CHEF',
            recipientIds: chefs.map((chef) => chef.id),
          },
        }),
      );
      return { id: row.id, alreadyRequested: false, status: row.status };
    });
  }

  async createRecipe(actor: Actor, dto: any) {
    if (actor.userType !== 'HEAD_CHEF')
      throw new ForbiddenException(
        'Chỉ bếp trưởng được tạo và thiết lập định lượng công thức trên màn bếp.',
      );
    if (dto.activate)
      throw new BadRequestException(
        'Cần gửi duyệt công thức; không được áp dụng ngay khi tạo.',
      );
    const expectedWastePercent = Number(dto.expectedWastePercent ?? 0);
    if (
      !Number.isFinite(expectedWastePercent) ||
      expectedWastePercent < 0 ||
      expectedWastePercent >= 100 ||
      Math.abs(expectedWastePercent - Number(expectedWastePercent.toFixed(2))) >
        1e-9
    )
      throw new BadRequestException(
        'Hao hụt dự kiến từ 0 đến dưới 100%, tối đa 2 chữ số thập phân.',
      );
    const branchId = this.resolveBranch(actor, dto.branchId);
    if (
      dto.description != null &&
      (typeof dto.description !== 'string' ||
        dto.description.trim().length > 500)
    )
      throw new BadRequestException(
        'Mô tả công thức phải là chuỗi tối đa 500 ký tự.',
      );
    const description = dto.description?.trim() || null;
    if (
      !Number.isFinite(Number(dto.yieldQuantity)) ||
      !(Number(dto.yieldQuantity) > 0) ||
      !Array.isArray(dto.items) ||
      !dto.items.length
    )
      throw new BadRequestException('Recipe yield and items are required');
    const product = await this.products.findOne({
      where: { id: dto.productId },
    });
    if (
      !product ||
      !(await canUseStockProduct(this.dataSource.manager, product, branchId))
    )
      throw new BadRequestException('RECIPE_PRODUCT_BRANCH_MISMATCH');
    if (product.productType && product.productType !== 'FINISHED_GOOD')
      throw new BadRequestException('FINISHED_GOOD_REQUIRED');
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
      if (ingredient?.productType && ingredient.productType !== 'INGREDIENT')
        throw new BadRequestException('INGREDIENT_REQUIRED');
      const unit = unitsById.get(item.unitId);
      const baseUnit = ingredient?.baseUnitId
        ? await this.units.findOne({ where: { id: ingredient.baseUnitId } })
        : null;
      if (
        !Number.isFinite(Number(item.quantity)) ||
        !(Number(item.quantity) > 0) ||
        !unit ||
        !baseUnit ||
        unit.dimension !== baseUnit.dimension
      )
        throw new BadRequestException(
          `INCOMPATIBLE_INGREDIENT_UNIT:${item.ingredientProductId}`,
        );
      if (
        ingredient &&
        !(await canUseStockProduct(
          this.dataSource.manager,
          ingredient,
          branchId,
        ))
      )
        throw new BadRequestException('RECIPE_INGREDIENT_BRANCH_MISMATCH');
    }
    return this.dataSource.transaction(async (manager) => {
      await this.operations.lock(manager, branchId);
      await this.movements.lockProducts(manager, [dto.productId, ...ids]);
      const fresh = await manager
        .getRepository(Product)
        .find({ where: { id: In([dto.productId, ...ids]) } });
      for (const previous of [product, ...ingredientProducts]) {
        const current = fresh.find((p) => p.id === previous.id);
        if (
          !current ||
          current.baseUnitId !== previous.baseUnitId ||
          current.productType !== previous.productType ||
          current.branchId !== previous.branchId
        )
          throw new ConflictException('PRODUCT_CHANGED_RETRY');
      }
      const latest = await manager.getRepository(KitchenRecipe).findOne({
        where: { branchId, productId: dto.productId },
        order: { version: 'DESC' },
      });
      const recipe = await manager.save(
        KitchenRecipe,
        manager.create(KitchenRecipe, {
          branchId,
          productId: dto.productId,
          version: (latest?.version || 0) + 1,
          description,
          yieldQuantity: dto.yieldQuantity,
          yieldUnitId: dto.yieldUnitId,
          status: 'DRAFT',
          expectedWastePercent,
          approval: {},
          effectiveFrom: null,
          createdBy: actor.userId,
        }),
      );
      await manager.save(
        KitchenRecipeItem,
        dto.items.map((item: any) =>
          manager.create(KitchenRecipeItem, {
            recipeId: recipe.id,
            ingredientProductId: item.ingredientProductId,
            quantity: Number(item.quantity),
            unitId: item.unitId,
            createdBy: actor.userId,
          }),
        ),
      );
      const requests = await manager
        .getRepository(KitchenOperation)
        .findBy({
          branchId,
          kind: 'recipe-request',
          parentId: dto.productId,
          status: In(['OPEN', 'DRAFTED']),
        });
      for (const request of requests) {
        request.status = 'DRAFTED';
        request.payload = {
          ...request.payload,
          recipeId: recipe.id,
          draftedBy: actor.userId,
          draftedAt: new Date().toISOString(),
        };
        request.updatedBy = actor.userId;
        await manager.save(KitchenOperation, request);
      }
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
    // Compatibility URL now follows the exact same approval checks.
    return this.reviewRecipe(actor, id, 'approve');
  }

  async reviewRecipe(
    actor: Actor,
    id: string,
    action: string,
    reason?: string,
  ) {
    const submit = action === 'submit';
    if (!['submit', 'approve', 'request-changes'].includes(action))
      throw new BadRequestException('Thao tác duyệt không hợp lệ.');
    if (
      submit
        ? actor.userType !== 'HEAD_CHEF'
        : !['ADMIN', 'MANAGER'].includes(actor.userType)
    )
      throw new ForbiddenException('Bạn không có quyền duyệt công thức.');
    if (
      action === 'request-changes' &&
      (typeof reason !== 'string' ||
        !reason.trim() ||
        reason.trim().length > 1000)
    )
      throw new BadRequestException('Cần lý do chỉnh sửa tối đa 1000 ký tự.');
    const reference = await this.recipes.findOne({ where: { id } });
    if (!reference) throw new NotFoundException('Không tìm thấy công thức.');
    this.resolveBranch(actor, reference.branchId);
    return this.dataSource.transaction(async (manager) => {
      await this.operations.lock(manager, reference.branchId);
      const repo = manager.getRepository(KitchenRecipe);
      const row = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Không tìm thấy công thức.');
      if (submit && row.createdBy !== actor.userId)
        throw new ForbiddenException(
          'Chỉ được gửi duyệt công thức do bạn tạo.',
        );
      if (
        submit
          ? !['DRAFT', 'REVISION_REQUESTED'].includes(row.status)
          : row.status !== 'PENDING_REVIEW'
      )
        throw new ConflictException(
          'Trạng thái công thức đã thay đổi. Hãy làm mới.',
        );
      const approval: Record<string, any> = {
        ...row.approval,
        history: [...(row.approval?.history || [])],
      };
      if (submit) {
        const full = await repo.findOne({
          where: { id },
          relations: ['items', 'items.ingredientProduct', 'items.unit'],
        });
        await this.movements.lockProducts(
          manager,
          full!.items.map((item) => item.ingredientProductId),
        );
        // Reload prices after product locks, then pin the submitted costing.
        const current = await repo.findOne({
          where: { id },
          relations: ['items', 'items.ingredientProduct', 'items.unit'],
        });
        const costing = recipeCosting(
          current,
          await manager.getRepository(MeasurementUnit).find(),
        );
        approval.costing = costing;
        approval.submittedBy = actor.userId;
        approval.submittedAt = new Date().toISOString();
        approval.reason = null;
        row.status = 'PENDING_REVIEW';
        const requests = await manager
          .getRepository(KitchenOperation)
          .findBy({
            branchId: row.branchId,
            kind: 'recipe-request',
            parentId: row.productId,
            status: In(['DRAFTED', 'SUBMITTED']),
          });
        for (const request of requests) {
          if (request.payload.recipeId !== row.id) continue;
          request.status = 'SUBMITTED';
          request.payload = {
            ...request.payload,
            recipeId: row.id,
            submittedAt: new Date().toISOString(),
            requesterReadAt: null,
          };
          request.updatedBy = actor.userId;
          await manager.save(KitchenOperation, request);
        }
      } else if (action === 'approve') {
        if (!approval.costing?.complete) {
          const full = await repo.findOne({
            where: { id },
            relations: ['items', 'items.ingredientProduct', 'items.unit'],
          });
          await this.movements.lockProducts(
            manager,
            full!.items.map((item) => item.ingredientProductId),
          );
          const current = await repo.findOne({
            where: { id },
            relations: ['items', 'items.ingredientProduct', 'items.unit'],
          });
          const costing = recipeCosting(current, await manager.getRepository(MeasurementUnit).find());
          if (!costing.complete)
            throw new ConflictException(
              `Cần khai báo giá vốn theo đơn vị tồn chuẩn trước khi duyệt: ${costing.missing.join(', ')}.`,
            );
          approval.costing = costing;
        }
        await manager.update(
          KitchenRecipe,
          {
            branchId: row.branchId,
            productId: row.productId,
            status: 'ACTIVE',
          },
          { status: 'INACTIVE', updatedBy: actor.userId },
        );
        row.status = 'ACTIVE';
        row.effectiveFrom = new Date();
        approval.approvedBy = actor.userId;
        approval.approvedAt = new Date().toISOString();
      } else {
        row.status = 'REVISION_REQUESTED';
        approval.reason = reason!.trim();
        approval.reviewedBy = actor.userId;
        approval.reviewedAt = new Date().toISOString();
      }
      approval.history.push({
        action,
        actorId: actor.userId,
        at: new Date().toISOString(),
        ...(action === 'request-changes' ? { reason: reason!.trim() } : {}),
      });
      row.approval = approval;
      row.updatedBy = actor.userId;
      await repo.save(row);
      return repo.findOne({
        where: { id },
        relations: ['items', 'items.unit'],
      });
    });
  }

  async deleteDraftRecipe(actor: Actor, id: string) {
    if (!['ADMIN', 'MANAGER'].includes(actor.userType))
      throw new ForbiddenException('Bạn không có quyền xóa bản nháp.');
    const recipe = await this.recipes.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    this.resolveBranch(actor, recipe.branchId);
    return this.dataSource.transaction(async (manager) => {
      await this.operations.lock(manager, recipe.branchId);
      const repo = manager.getRepository(KitchenRecipe);
      const current = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current || current.status !== 'DRAFT')
        throw new BadRequestException(
          'Chỉ xóa công thức ở trạng thái bản nháp.',
        );
      await repo.remove(current);
      return { deleted: true };
    });
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
    const task = await this.dataSource
      .getRepository(KitchenOperation)
      .findOneBy({
        kind: 'task-flow',
        parentId: id,
        branchId: ticket.branchId,
      });
    if (task)
      throw new ConflictException(
        'Hãy thao tác đơn này qua luồng Nhiệm vụ bếp.',
      );
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

  async assertTaskHandover(orderId: string) {
    const ticket = await this.tickets.findOne({ where: { orderId } });
    if (!ticket) return;
    const task = await this.dataSource
      .getRepository(KitchenOperation)
      .findOneBy({
        kind: 'task-flow',
        parentId: ticket.id,
        branchId: ticket.branchId,
      });
    if (task && task.status !== 'HANDED_OVER')
      throw new ConflictException(
        'Cần ghi người nhận và bàn giao trong Nhiệm vụ bếp trước khi kết thúc đơn.',
      );
  }

  async markDelivered(orderId: string, changedBy?: string) {
    await this.assertTaskHandover(orderId);
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
    return this.tickets.exist({ where: { orderId } });
  }

  async orderForLegacyStockExport(order: any) {
    const productIds = (order?.items || []).map((item: any) => item.productId);
    if (!productIds.length || !order?.branchId) return order;
    const cookingProducts = await this.products.find({
      where: { id: In(productIds), productType: 'FINISHED_GOOD' },
      select: ['id'],
    });
    const cookingIds = new Set(cookingProducts.map((product) => product.id));
    order = {
      ...order,
      items: (order.items || []).filter(
        (item: any) => !cookingIds.has(item.productId),
      ),
    };
    const recipeStockEnabled =
      String(
        this.config.get('KITCHEN_RECIPE_STOCK_ENABLED') ?? 'false',
      ).toLowerCase() === 'true';
    if (!recipeStockEnabled || !order?.branchId) return order;
    if (!order.items.length) return order;
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
      await this.operations.lock(manager, plan.branchId);
      for (const shift of ['Ca sáng', 'Ca trưa', 'Ca chiều'])
        await this.operations.unlocked(
          manager,
          plan.branchId,
          plan.planDate,
          shift,
        );
      const current = await manager
        .getRepository(KitchenMealPlan)
        .findOneByOrFail({ id: plan.id });
      if (current.status === 'LOCKED') return;
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
            shift:
              plan.mealPeriod === 'BREAKFAST'
                ? 'Ca sáng'
                : plan.mealPeriod === 'LUNCH'
                  ? 'Ca trưa'
                  : 'Ca chiều',
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
      where: {
        branchId,
        planDate: date,
        ...(mealPeriod ? { mealPeriod } : {}),
      },
    });
    if (!plan) {
      await this.mealPlans.upsert(
        { branchId, planDate: date, mealPeriod, status: 'DRAFT' },
        ['branchId', 'planDate', 'mealPeriod'],
      );
      plan = await this.mealPlans.findOneOrFail({
        where: {
          branchId,
          planDate: date,
          ...(mealPeriod ? { mealPeriod } : {}),
        },
      });
    }
    return plan;
  }

  async lockDuePlans() {
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
      await this.operations.lock(manager, batch.mealPlan.branchId);
      await this.operations.unlocked(
        manager,
        batch.mealPlan.branchId,
        batch.mealPlan.planDate,
        batch.shift,
      );
      const lockedBatch = await manager
        .getRepository(KitchenProductionBatch)
        .findOneByOrFail({ id: batch.id });
      if (
        Number(lockedBatch.plannedQuantity) +
          Number(lockedBatch.adjustmentQuantity) +
          dto.quantity <
        0
      )
        throw new BadRequestException('NEGATIVE_PLANNED_QUANTITY');
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
    return this.operations.transition(actor, id, { expectedVersion }, target);
  }

  private async calculateDemand(
    branchId: string,
    date: string,
    mealPeriod: string,
    stationId?: string,
  ) {
    const productQuantities = new Map<string, number>();
    const plans = await this.mealPlans.find({
      where: {
        branchId,
        planDate: date,
        ...(mealPeriod ? { mealPeriod } : {}),
      },
      relations: ['batches'],
    });
    for (const plan of plans)
      for (const batch of plan.batches || [])
        if (
          !batch.details?.workflowTicketId &&
          (!stationId || batch.stationId === stationId)
        )
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
      .andWhere(
        "CAST(t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS date)=:date",
        {
          date,
        },
      )
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

  async staffOverview(actor: Actor, query: any) {
    const branchId = this.resolveBranch(actor, query.branchId);
    const date = query.date || localDate();
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(`${date}T00:00:00+07:00`))
    )
      throw new BadRequestException('INVALID_DATE');
    const plans = await this.mealPlans.find({
      where: { branchId, planDate: date },
      relations: ['batches'],
    });
    const batches = plans.flatMap((plan) =>
      (plan.batches || [])
        .filter((batch) => !batch.details?.workflowTicketId)
        .map((batch) => ({
          ...batch,
          mealPeriod: plan.mealPeriod,
        })),
    );
    const start = new Date(`${date}T00:00:00+07:00`);
    const end = new Date(start.getTime() + 86400000 - 1);
    const tickets = (
      await this.tickets.find({
        where: { branchId, createdAt: Between(start, end) },
        relations: ['items', 'order'],
        order: { createdAt: 'ASC' },
      })
    ).filter((ticket) =>
      ['WAITING', 'PREPARING', 'READY', 'DELIVERED'].includes(ticket.status),
    );
    const demand = await this.getDemand(actor, { branchId, date });
    const ingredients = new Map<string, any>(
      demand.map((line) => [line.productId, line]),
    );
    const ids = [
      ...new Set([
        ...batches.map((batch) => batch.productId),
        ...tickets.flatMap((ticket) =>
          (ticket.items || []).map((item) => item.productId),
        ),
        ...ingredients.keys(),
      ]),
    ];
    const products = ids.length
      ? await this.products.find({
          where: { id: In(ids) },
          select: ['id', 'name', 'unit', 'requiresSample', 'productType'],
        })
      : [];
    const byId = new Map(products.map((product) => [product.id, product]));
    const samples = batches.length
      ? await this.dataSource.getRepository(KitchenOperation).find({
          where: {
            branchId,
            kind: 'samples',
            parentId: In(batches.map((batch) => batch.id)),
          },
        })
      : [];
    const pendingSamples = batches.filter(
      (batch) =>
        byId.get(batch.productId)?.requiresSample &&
        ['PREPARING', 'READY', 'COMPLETED'].includes(batch.status) &&
        !samples.some(
          (sample) =>
            sample.parentId === batch.id &&
            Number(sample.payload.quantity) > 0 &&
            Date.parse(sample.payload.sampledAt) >=
              new Date(batch.startedAt!).getTime(),
        ),
    );
    const shortages = [...ingredients.values()]
      .map((line) => ({
        ...line,
        name: byId.get(line.productId)?.name || line.productId,
        shortageQuantity: Math.max(
          0,
          line.quantity - Number(line.availableQuantity || 0),
        ),
      }))
      .filter((line) => line.shortageQuantity > 0);
    const unitIds = [
      ...new Set(shortages.map((line) => line.unitId).filter(Boolean)),
    ];
    const units = unitIds.length
      ? await this.units.find({ where: { id: In(unitIds) } })
      : [];
    return {
      date,
      planCount: plans.length,
      portionQuantity: batches.reduce(
        (total, batch) =>
          total +
          Math.max(
            0,
            Number(batch.plannedQuantity) + Number(batch.adjustmentQuantity),
          ),
        0,
      ),
      dishCount: new Set([
        ...batches.map((batch) => batch.productId),
        ...tickets.flatMap((ticket) =>
          (ticket.items || [])
            .filter(
              (item) =>
                byId.get(item.productId)?.productType === 'FINISHED_GOOD',
            )
            .map((item) => item.productId),
        ),
      ]).size,
      inProgressCount:
        batches.filter((batch) => ['PREPARING', 'READY'].includes(batch.status))
          .length +
        tickets.filter((ticket) =>
          ['PREPARING', 'READY'].includes(ticket.status),
        ).length,
      completedCount:
        batches.filter((batch) => batch.status === 'COMPLETED').length +
        tickets.filter((ticket) => ticket.status === 'DELIVERED').length,
      taskCount: batches.length + tickets.length,
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        orderCode: ticket.order?.orderCode || ticket.orderId,
        orderNumber: ticket.order?.orderNumber,
        status: ticket.status,
        items: (ticket.items || []).map((item) => ({
          productId: item.productId,
          name: item.productName,
          quantity: Number(item.quantity),
        })),
      })),
      batches: batches.map((batch) => ({
        id: batch.id,
        name: byId.get(batch.productId)?.name || batch.productId,
        quantity: Math.max(
          0,
          Number(batch.plannedQuantity) + Number(batch.adjustmentQuantity),
        ),
        unit: byId.get(batch.productId)?.unit || 'suất',
        status: batch.status,
        shift: batch.shift,
      })),
      shortages: shortages.map((line) => ({
        ...line,
        unit: units.find((unit) => unit.id === line.unitId)?.code || '',
      })),
      missingSampleCount: pendingSamples.length,
    };
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
    const expiredRows = await this.dataSource.query(
      'SELECT l.product_id AS id, SUM(l.quantity) AS quantity FROM stock_lots l JOIN stocks s ON s.id=l.stock_id WHERE s.branch_id=$1 AND l.expires_at<$2 GROUP BY l.product_id',
      [branchId, localDate()],
    );
    for (const row of expiredRows)
      stock.set(
        row.id,
        Math.max(0, Number(stock.get(row.id) || 0) - Number(row.quantity)),
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
    return this.dataSource.transaction(async (manager) => {
      await this.operations.lock(manager, branchId);
      await this.operations.unlocked(
        manager,
        branchId,
        dto.date,
        dto.mealPeriod === 'BREAKFAST'
          ? 'Ca sáng'
          : dto.mealPeriod === 'LUNCH'
            ? 'Ca trưa'
            : 'Ca chiều',
      );
      const sessions = manager.getRepository(KitchenConsumptionSession);
      const previous = await sessions.findOne({
        where: {
          branchId,
          sessionDate: dto.date,
          mealPeriod: dto.mealPeriod,
          stationId: dto.stationId,
        },
        relations: ['lines'],
      });
      if (previous) return previous;
      const demand = await this.calculateDemand(
        branchId,
        dto.date,
        dto.mealPeriod,
        dto.stationId,
      );
      if (!demand.length) throw new BadRequestException('NO_RECIPE_DEMAND');
      const session = await sessions.save(
        sessions.create({
          branchId,
          sessionDate: dto.date,
          mealPeriod: dto.mealPeriod,
          stationId: dto.stationId,
          status: 'DRAFT',
          createdBy: actor.userId,
        }),
      );
      const lines = manager.getRepository(KitchenConsumptionLine);
      await lines.save(
        demand.map((line) =>
          lines.create({
            sessionId: session.id,
            productId: line.productId,
            expectedQuantity: line.quantity,
            actualQuantity: line.quantity,
            unitId: line.unitId,
            createdBy: actor.userId,
          }),
        ),
      );
      return sessions.findOneOrFail({
        where: { id: session.id },
        relations: ['lines'],
      });
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
        await this.operations.lock(manager, session.branchId);
        await this.operations.unlocked(
          manager,
          session.branchId,
          session.sessionDate,
          session.mealPeriod === 'BREAKFAST'
            ? 'Ca sáng'
            : session.mealPeriod === 'LUNCH'
              ? 'Ca trưa'
              : 'Ca chiều',
        );
        const locked = await manager
          .getRepository(KitchenConsumptionSession)
          .createQueryBuilder('s')
          .setLock('pessimistic_write')
          .where('s.id=:id', { id })
          .getOneOrFail();
        if (locked.status === 'CONFIRMED') return locked;
        const tracedBatches = await manager.query(
          `SELECT b.id FROM kitchen_production_batches b
           JOIN kitchen_meal_plans p ON p.id=b.meal_plan_id
           WHERE p.branch_id=$1 AND p.plan_date=$2 AND p.meal_period=$3
             AND b.station_id=$4 AND b.details->>'traceabilityVersion'='1' LIMIT 1`,
          [
            session.branchId,
            session.sessionDate,
            session.mealPeriod,
            session.stationId,
          ],
        );
        if (tracedBatches?.length)
          throw new ConflictException('SCOPE_ALREADY_CONSUMED_BY_BATCH');
        const stock = await manager
          .getRepository(Stock)
          .findOne({ where: { branchId: session.branchId } });
        if (!stock) throw new BadRequestException('BRANCH_STOCK_NOT_FOUND');
        await this.movements.lockProducts(
          manager,
          session.lines.map((line) => line.productId),
        );
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
          const supplied = suppliedLines.find(
            (l: any) => l.productId === line.productId,
          );
          await this.movements.change(
            manager,
            stock.id,
            line.productId,
            -actual,
            receipt.id,
            { allocations: supplied?.allocations, actorId: actor.userId },
          );
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
        `SELECT COALESCE(SUM(b.planned_quantity),0) "plannedQuantity", COALESCE(SUM(b.adjustment_quantity),0) "adjustmentQuantity", COALESCE(SUM(CASE WHEN b.status='COMPLETED' THEN b.actual_quantity ELSE 0 END),0) "actualQuantity" FROM kitchen_production_batches b JOIN kitchen_meal_plans p ON p.id=b.meal_plan_id WHERE p.branch_id=$1 AND p.plan_date BETWEEN $2::date AND $3::date`,
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
