import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealItem } from '../../entities/meal-item.entity';
import { Customer } from '../../entities/customer.entity';
import { CustomerMealItem } from '../../entities/customer-meal-item.entity';
import { BaseService } from '../../common/sql/base.service';
import { JwtPayload } from '../../common/interface/jwt-payload.interface';
import { CreateMealItemDto } from './dto/create-meal-item.dto';
import { UpdateMealItemDto } from './dto/update-meal-item.dto';
import { MealItemQueryDto } from './dto/meal-item-query.dto';
import { MEAL_PERIOD } from '../../common/constant/constant';

@Injectable()
export class MealItemService extends BaseService<MealItem> {
  constructor(
    @InjectRepository(MealItem)
    private mealItemRepository: Repository<MealItem>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(CustomerMealItem)
    private customerMealItemRepository: Repository<CustomerMealItem>,
  ) {
    super(mealItemRepository);
  }

  protected getEntityName(): string {
    return 'MealItem';
  }

  async findAll(filter: MealItemQueryDto = {}) {
    const query = this.mealItemRepository
      .createQueryBuilder('mealItem')
      .leftJoinAndSelect('mealItem.branch', 'branch')
      .leftJoinAndSelect('mealItem.product', 'product')
      .leftJoinAndSelect('product.category', 'category');

    this.applyMealItemFilter(query, filter);

    return query
      .orderBy('mealItem.date_key', 'ASC', 'NULLS LAST')
      .addOrderBy('mealItem.day_of_week', 'ASC', 'NULLS LAST')
      .addOrderBy('mealItem.meal_period', 'ASC')
      .addOrderBy('mealItem.sort_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .getMany();
  }

  async findAllForUser(filter: MealItemQueryDto = {}, userId?: string) {
    if (!userId) {
      return this.findAll(filter);
    }

    const customer = await this.customerRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      return this.findAll(filter);
    }

    const [defaultMealItems, customerMealItems] = await Promise.all([
      this.findAll(filter),
      this.findCustomerMealItems(customer.id, filter),
    ]);

    const mergedMealItems = new Map<string, MealItem>();

    customerMealItems.forEach((customerMealItem) => {
      const mealItem = customerMealItem.mealItem;
      if (!mealItem) {
        return;
      }

      (mealItem as any).customerMealItem = {
        id: customerMealItem.id,
        customerId: customerMealItem.customerId,
        mealItemId: customerMealItem.mealItemId,
        quantity: customerMealItem.quantity,
        status: customerMealItem.status,
        note: customerMealItem.note,
      };

      mergedMealItems.set(mealItem.id, mealItem);
    });

    defaultMealItems.forEach((mealItem) => {
      if (!mergedMealItems.has(mealItem.id)) {
        mergedMealItems.set(mealItem.id, mealItem);
      }
    });

    return Array.from(mergedMealItems.values()).sort((left, right) =>
      this.compareMealItems(left, right),
    );
  }

  async getWeekPlan(filter: MealItemQueryDto = {}, userId?: string) {
    const range = this.resolveWeekRange(filter);
    const mealItems = await this.findAllForUser(
      {
        ...filter,
        dateKey: undefined,
        from: range.from,
        to: range.to,
      },
      userId,
    );
    const mealPeriods = this.resolveWeekMealPeriods(filter, mealItems);
    const days = this.buildWeekDays(range.from, range.to).map((dateKey) => ({
      dateKey,
      dayOfWeek: this.getDayOfWeek(dateKey),
      meals: mealPeriods.map((mealPeriod) => ({
        mealPeriod,
        items: mealItems.filter(
          (item) => item.dateKey === dateKey && item.mealPeriod === mealPeriod,
        ),
      })),
    }));
    const addedSlots = days.reduce((total, day) => {
      return total + day.meals.filter((meal) => meal.items.length > 0).length;
    }, 0);

    return {
      from: range.from,
      to: range.to,
      branchId: filter.branchId || null,
      level: filter.level || null,
      status: filter.status || null,
      mealPeriods,
      totalSlots: days.length * mealPeriods.length,
      addedSlots,
      days,
    };
  }

  private async findCustomerMealItems(
    customerId: string,
    filter: MealItemQueryDto,
  ) {
    const query = this.customerMealItemRepository
      .createQueryBuilder('customerMealItem')
      .leftJoinAndSelect('customerMealItem.mealItem', 'mealItem')
      .leftJoinAndSelect('mealItem.branch', 'branch')
      .leftJoinAndSelect('mealItem.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .where('customerMealItem.customer_id = :customerId', { customerId });

    this.applyMealItemFilter(query, filter);

    if (filter.status) {
      query.andWhere('customerMealItem.status = :status', {
        status: filter.status,
      });
    }

    return query.getMany();
  }

  private applyMealItemFilter(query: any, filter: MealItemQueryDto) {
    if (filter.branchId) {
      query.andWhere('mealItem.branch_id = :branchId', {
        branchId: filter.branchId,
      });
    }

    if (filter.mealPeriod) {
      query.andWhere('mealItem.meal_period = :mealPeriod', {
        mealPeriod: filter.mealPeriod,
      });
    }

    if (filter.level) {
      query.andWhere('mealItem.level = :level', { level: filter.level });
    }

    if (filter.dayOfWeek !== undefined) {
      query.andWhere('mealItem.day_of_week = :dayOfWeek', {
        dayOfWeek: filter.dayOfWeek,
      });
    }

    if (filter.dateKey) {
      query.andWhere('mealItem.date_key = :dateKey', {
        dateKey: filter.dateKey,
      });
    } else {
      if (filter.from) {
        query.andWhere('mealItem.date_key >= :from', { from: filter.from });
      }

      if (filter.to) {
        query.andWhere('mealItem.date_key <= :to', { to: filter.to });
      }
    }

    if (filter.status) {
      query.andWhere('mealItem.status = :status', { status: filter.status });
    }
  }

  private compareMealItems(left: MealItem, right: MealItem) {
    return (
      this.compareNullableString(left.dateKey, right.dateKey) ||
      this.compareNullableNumber(left.dayOfWeek, right.dayOfWeek) ||
      left.mealPeriod.localeCompare(right.mealPeriod) ||
      left.sortOrder - right.sortOrder ||
      (left.product?.name || '').localeCompare(right.product?.name || '')
    );
  }

  private compareNullableString(left?: string, right?: string) {
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return left.localeCompare(right);
  }

  private compareNullableNumber(left?: number, right?: number) {
    if (left === undefined && right === undefined) return 0;
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    return left - right;
  }

  private resolveWeekMealPeriods(
    filter: MealItemQueryDto,
    mealItems: MealItem[],
  ) {
    if (filter.mealPeriod) {
      return [filter.mealPeriod];
    }

    const defaultMealPeriods = [
      MEAL_PERIOD.BREAKFAST,
      MEAL_PERIOD.LUNCH,
      MEAL_PERIOD.AFTERNOON,
    ];
    const mealPeriodOrder = [
      MEAL_PERIOD.BREAKFAST,
      MEAL_PERIOD.LUNCH,
      MEAL_PERIOD.AFTERNOON,
      MEAL_PERIOD.DINNER,
    ];
    const extraMealPeriods = Array.from(
      new Set(mealItems.map((mealItem) => mealItem.mealPeriod)),
    )
      .filter((mealPeriod) => !defaultMealPeriods.includes(mealPeriod as any))
      .sort(
        (left, right) =>
          mealPeriodOrder.indexOf(left as any) -
          mealPeriodOrder.indexOf(right as any),
      );

    return [...defaultMealPeriods, ...extraMealPeriods];
  }

  private resolveWeekRange(filter: MealItemQueryDto) {
    if (filter.from && filter.to) {
      return { from: filter.from, to: filter.to };
    }

    const baseDateKey =
      filter.dateKey || filter.from || this.toDateKey(new Date());
    const baseDate = this.parseDateKey(baseDateKey);
    const day = baseDate.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = this.addDays(baseDate, mondayOffset);
    const sunday = this.addDays(monday, 6);

    return {
      from: this.toDateKey(monday),
      to: this.toDateKey(sunday),
    };
  }

  private buildWeekDays(from: string, to: string) {
    const days: string[] = [];
    let current = this.parseDateKey(from);
    const end = this.parseDateKey(to);

    while (current.getTime() <= end.getTime()) {
      days.push(this.toDateKey(current));
      current = this.addDays(current, 1);
    }

    return days;
  }

  private parseDateKey(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
  }

  private toDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private getDayOfWeek(dateKey: string) {
    return this.parseDateKey(dateKey).getUTCDay();
  }

  async findOne(id: string) {
    const mealItem = await this.mealItemRepository.findOne({
      where: { id },
      relations: ['branch', 'product', 'product.category'],
    });

    if (!mealItem) {
      return super.findOne(id);
    }

    return mealItem;
  }

  async createMealItem(dto: CreateMealItemDto, user: JwtPayload) {
    return this.create(dto, user);
  }

  async updateMealItem(id: string, dto: UpdateMealItemDto, user: JwtPayload) {
    return this.update(id, dto, user);
  }

  async delete(id: string, user: JwtPayload): Promise<MealItem> {
    const item = await this.findOne(id);
    item.updatedBy = user.userId;
    await this.mealItemRepository.remove(item);
    return item;
  }
}
