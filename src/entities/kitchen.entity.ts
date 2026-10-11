import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
  VersionColumn,
} from 'typeorm';
import { BaseEntity } from '../common/sql/base.entity';
import { Branch } from './branch.entity';
import { Employee } from './employee.entity';
import { MealItem } from './meal-item.entity';
import { Order } from './order.entity';
import { Product } from './product.entity';

export const KITCHEN_TICKET_STATUS = {
  WAITING: 'WAITING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
} as const;
export const KITCHEN_BATCH_STATUS = {
  WAITING: 'WAITING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
} as const;

@Entity('measurement_units')
export class MeasurementUnit extends BaseEntity {
  @Column('varchar', { unique: true }) code: string;
  @Column('varchar') name: string;
  @Column('varchar') dimension: string;
  @Column('numeric', { name: 'factor_to_base', precision: 18, scale: 6 })
  factorToBase: number;
  @Column('boolean', { default: true, name: 'is_active' }) isActive: boolean;
}

@Entity('kitchen_stations')
@Unique('UQ_kitchen_station_branch_code', ['branchId', 'code'])
export class KitchenStation extends BaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('varchar') code: string;
  @Column('varchar') name: string;
  @Column('text', { nullable: true }) description?: string | null;
  @Column('boolean', { default: true, name: 'is_active' }) isActive: boolean;
  @ManyToOne(() => Branch) @JoinColumn({ name: 'branch_id' }) branch: Branch;
}

@Entity('kitchen_product_stations')
@Unique('UQ_kitchen_product_station_branch_product', ['branchId', 'productId'])
export class KitchenProductStation extends BaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('uuid', { name: 'product_id' }) productId: string;
  @Column('uuid', { name: 'station_id' }) stationId: string;
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
  @ManyToOne(() => KitchenStation)
  @JoinColumn({ name: 'station_id' })
  station: KitchenStation;
}

@Entity('kitchen_recipes')
@Unique('UQ_kitchen_recipe_version', ['branchId', 'productId', 'version'])
export class KitchenRecipe extends BaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('uuid', { name: 'product_id' }) productId: string;
  @Column('int') version: number;
  @Column('numeric', { name: 'yield_quantity', precision: 12, scale: 3 })
  yieldQuantity: number;
  @Column('uuid', { name: 'yield_unit_id' }) yieldUnitId: string;
  @Column('varchar', { default: 'DRAFT' }) status: string;
  @Column('timestamptz', { nullable: true, name: 'effective_from' })
  effectiveFrom?: Date | null;
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;
  @ManyToOne(() => MeasurementUnit)
  @JoinColumn({ name: 'yield_unit_id' })
  yieldUnit: MeasurementUnit;
  @OneToMany(() => KitchenRecipeItem, (item) => item.recipe, { cascade: true })
  items: KitchenRecipeItem[];
}

@Entity('kitchen_recipe_items')
@Unique('UQ_kitchen_recipe_ingredient', ['recipeId', 'ingredientProductId'])
export class KitchenRecipeItem extends BaseEntity {
  @Column('uuid', { name: 'recipe_id' }) recipeId: string;
  @Column('uuid', { name: 'ingredient_product_id' })
  ingredientProductId: string;
  @Column('numeric', { precision: 14, scale: 4 }) quantity: number;
  @Column('uuid', { name: 'unit_id' }) unitId: string;
  @ManyToOne(() => KitchenRecipe, (recipe) => recipe.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe: KitchenRecipe;
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'ingredient_product_id' })
  ingredientProduct: Product;
  @ManyToOne(() => MeasurementUnit)
  @JoinColumn({ name: 'unit_id' })
  unit: MeasurementUnit;
}

@Entity('kitchen_service_periods')
@Unique('UQ_kitchen_period_branch_meal', ['branchId', 'mealPeriod'])
export class KitchenServicePeriod extends BaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('varchar', { name: 'meal_period' }) mealPeriod: string;
  @Column('time', { name: 'start_time' }) startTime: string;
  @Column('time', { name: 'end_time' }) endTime: string;
  @Column('time', { name: 'cutoff_time' }) cutoffTime: string;
  @Column('varchar', { default: 'Asia/Bangkok' }) timezone: string;
  @Column('boolean', { default: true, name: 'is_active' }) isActive: boolean;
}

@Entity('kitchen_order_tickets')
@Unique('UQ_kitchen_ticket_order', ['orderId'])
export class KitchenOrderTicket extends BaseEntity {
  @Column('uuid', { name: 'order_id' }) orderId: string;
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('uuid', { nullable: true, name: 'station_id' }) stationId?:
    | string
    | null;
  @Column('varchar', { default: KITCHEN_TICKET_STATUS.WAITING }) status: string;
  @VersionColumn() version: number;
  @Column('timestamptz', { nullable: true, name: 'started_at' })
  startedAt?: Date | null;
  @Column('timestamptz', { nullable: true, name: 'ready_at' })
  readyAt?: Date | null;
  @Column('timestamptz', { nullable: true, name: 'delivered_at' })
  deliveredAt?: Date | null;
  @ManyToOne(() => Order) @JoinColumn({ name: 'order_id' }) order: Order;
  @ManyToOne(() => KitchenStation, { nullable: true })
  @JoinColumn({ name: 'station_id' })
  station?: KitchenStation | null;
  @OneToMany(() => KitchenOrderTicketItem, (item) => item.ticket, {
    cascade: true,
  })
  items: KitchenOrderTicketItem[];
}

@Entity('kitchen_order_ticket_items')
export class KitchenOrderTicketItem extends BaseEntity {
  @Column('uuid', { name: 'ticket_id' }) ticketId: string;
  @Column('uuid', { name: 'product_id' }) productId: string;
  @Column('varchar', { name: 'product_name' }) productName: string;
  @Column('int') quantity: number;
  @Column('text', { nullable: true }) note?: string | null;
  @ManyToOne(() => KitchenOrderTicket, (ticket) => ticket.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket: KitchenOrderTicket;
}

@Entity('kitchen_meal_plans')
@Unique('UQ_kitchen_meal_plan_slot', ['branchId', 'planDate', 'mealPeriod'])
export class KitchenMealPlan extends BaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('date', { name: 'plan_date' }) planDate: string;
  @Column('varchar', { name: 'meal_period' }) mealPeriod: string;
  @Column('varchar', { default: 'DRAFT' }) status: string;
  @Column('timestamptz', { nullable: true, name: 'locked_at' })
  lockedAt?: Date | null;
  @Column('uuid', { nullable: true, name: 'locked_by' }) lockedBy?:
    | string
    | null;
  @OneToMany(() => KitchenProductionBatch, (batch) => batch.mealPlan)
  batches: KitchenProductionBatch[];
}

@Entity('kitchen_production_batches')
@Unique('UQ_kitchen_batch_meal_item', ['mealPlanId', 'mealItemId'])
export class KitchenProductionBatch extends BaseEntity {
  @Column('uuid', { name: 'meal_plan_id' }) mealPlanId: string;
  @Column('uuid', { name: 'meal_item_id' }) mealItemId: string;
  @Column('uuid', { name: 'product_id' }) productId: string;
  @Column('uuid', { nullable: true, name: 'station_id' }) stationId?:
    | string
    | null;
  @Column('int', { name: 'planned_quantity' }) plannedQuantity: number;
  @Column('int', { default: 0, name: 'adjustment_quantity' })
  adjustmentQuantity: number;
  @Column('varchar', { default: KITCHEN_BATCH_STATUS.WAITING }) status: string;
  @VersionColumn() version: number;
  @Column('timestamptz', { nullable: true, name: 'started_at' })
  startedAt?: Date | null;
  @Column('timestamptz', { nullable: true, name: 'ready_at' })
  readyAt?: Date | null;
  @Column('timestamptz', { nullable: true, name: 'completed_at' })
  completedAt?: Date | null;
  @ManyToOne(() => KitchenMealPlan, (plan) => plan.batches, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meal_plan_id' })
  mealPlan: KitchenMealPlan;
  @ManyToOne(() => MealItem)
  @JoinColumn({ name: 'meal_item_id' })
  mealItem: MealItem;
}

@Entity('kitchen_batch_adjustments')
export class KitchenBatchAdjustment extends BaseEntity {
  @Column('uuid', { name: 'batch_id' }) batchId: string;
  @Column('int') quantity: number;
  @Column('text') reason: string;
  @Column('uuid', { name: 'changed_by' }) changedBy: string;
}

@Entity('kitchen_consumption_sessions')
@Unique('UQ_kitchen_consumption_scope', [
  'branchId',
  'sessionDate',
  'mealPeriod',
  'stationId',
])
export class KitchenConsumptionSession extends BaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('date', { name: 'session_date' }) sessionDate: string;
  @Column('varchar', { name: 'meal_period' }) mealPeriod: string;
  @Column('uuid', { name: 'station_id' }) stationId: string;
  @Column('varchar', { default: 'DRAFT' }) status: string;
  @Column('uuid', { nullable: true, name: 'stock_export_id' }) stockExportId?:
    | string
    | null;
  @Column('timestamptz', { nullable: true, name: 'confirmed_at' })
  confirmedAt?: Date | null;
  @OneToMany(() => KitchenConsumptionLine, (line) => line.session, {
    cascade: true,
  })
  lines: KitchenConsumptionLine[];
}

@Entity('kitchen_consumption_lines')
@Unique('UQ_kitchen_consumption_product', ['sessionId', 'productId'])
export class KitchenConsumptionLine extends BaseEntity {
  @Column('uuid', { name: 'session_id' }) sessionId: string;
  @Column('uuid', { name: 'product_id' }) productId: string;
  @Column('numeric', { name: 'expected_quantity', precision: 14, scale: 4 })
  expectedQuantity: number;
  @Column('numeric', { name: 'actual_quantity', precision: 14, scale: 4 })
  actualQuantity: number;
  @Column('uuid', { name: 'unit_id' }) unitId: string;
  @ManyToOne(() => KitchenConsumptionSession, (session) => session.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: KitchenConsumptionSession;
}

@Entity('kitchen_stock_shortages')
export class KitchenStockShortage extends BaseEntity {
  @Column('uuid', { name: 'session_id' })
  sessionId: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('numeric', { name: 'required_quantity', precision: 14, scale: 4 })
  requiredQuantity: number;

  @Column('numeric', { name: 'available_quantity', precision: 14, scale: 4 })
  availableQuantity: number;

  @Column('numeric', { name: 'shortage_quantity', precision: 14, scale: 4 })
  shortageQuantity: number;
}

@Entity('kitchen_assignments')
export class KitchenAssignment extends BaseEntity {
  @Column('uuid', { name: 'branch_id' }) branchId: string;
  @Column('uuid', { name: 'employee_id' }) employeeId: string;
  @Column('uuid', { name: 'station_id' }) stationId: string;
  @Column('uuid', { nullable: true, name: 'batch_id' }) batchId?: string | null;
  @Column('date', { name: 'work_date' }) workDate: string;
  @Column('varchar') shift: string;
  @Column('varchar', { default: 'ACTIVE' }) status: string;
  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
  @ManyToOne(() => KitchenStation)
  @JoinColumn({ name: 'station_id' })
  station: KitchenStation;
}
