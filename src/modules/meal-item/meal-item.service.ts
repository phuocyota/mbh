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
