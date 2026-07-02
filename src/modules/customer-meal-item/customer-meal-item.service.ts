import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CustomerMealItem } from '../../entities/customer-meal-item.entity';
import { BaseService } from '../../common/sql/base.service';
import { JwtPayload } from '../../common/interface/jwt-payload.interface';
import { CreateCustomerMealItemDto } from './dto/create-customer-meal-item.dto';
import { UpdateCustomerMealItemDto } from './dto/update-customer-meal-item.dto';
import { CustomerMealItemQueryDto } from './dto/customer-meal-item-query.dto';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class CustomerMealItemService extends BaseService<CustomerMealItem> {
  constructor(
    @InjectRepository(CustomerMealItem)
    private customerMealItemRepository: Repository<CustomerMealItem>,
  ) {
    super(customerMealItemRepository);
  }

  protected getEntityName(): string {
    return 'CustomerMealItem';
  }

  async findAll(filter: CustomerMealItemQueryDto = {}) {
    const pagination = normalizePagination(filter.page, filter.size);
    const query = this.customerMealItemRepository
      .createQueryBuilder('customerMealItem')
      .leftJoinAndSelect('customerMealItem.customer', 'customer')
      .leftJoinAndSelect('customerMealItem.mealItem', 'mealItem')
      .leftJoinAndSelect('mealItem.branch', 'branch')
      .leftJoinAndSelect('mealItem.product', 'product')
      .leftJoinAndSelect('product.category', 'category');

    if (filter.customerId) {
      query.andWhere('customerMealItem.customer_id = :customerId', {
        customerId: filter.customerId,
      });
    }

    if (filter.mealItemId) {
      query.andWhere('customerMealItem.meal_item_id = :mealItemId', {
        mealItemId: filter.mealItemId,
      });
    }

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
      query.andWhere('customerMealItem.status = :status', {
        status: filter.status,
      });
    }

    const orderedQuery = query
      .orderBy('mealItem.date_key', 'ASC', 'NULLS LAST')
      .addOrderBy('mealItem.day_of_week', 'ASC', 'NULLS LAST')
      .addOrderBy('mealItem.meal_period', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .addOrderBy('customer.full_name', 'ASC');

    const [idRows, total] = await Promise.all([
      orderedQuery
        .clone()
        .select('customerMealItem.id', 'id')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      orderedQuery.clone().getCount(),
    ]);

    const ids = idRows.map((row) => row.id);
    if (!ids.length) {
      return toPaginationResponse([], total, pagination.page, pagination.size);
    }

    const customerMealItems = await this.customerMealItemRepository.find({
      where: { id: In(ids) },
      relations: [
        'customer',
        'mealItem',
        'mealItem.branch',
        'mealItem.product',
        'mealItem.product.category',
      ],
    });

    const customerMealItemById = new Map(
      customerMealItems.map((customerMealItem) => [
        customerMealItem.id,
        customerMealItem,
      ]),
    );
    const data = ids
      .map((id) => customerMealItemById.get(id))
      .filter(
        (customerMealItem): customerMealItem is CustomerMealItem =>
          !!customerMealItem,
      );

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async findOne(id: string) {
    const customerMealItem = await this.customerMealItemRepository.findOne({
      where: { id },
      relations: [
        'customer',
        'mealItem',
        'mealItem.branch',
        'mealItem.product',
        'mealItem.product.category',
      ],
    });

    if (!customerMealItem) {
      return super.findOne(id);
    }

    return customerMealItem;
  }

  async createCustomerMealItem(
    dto: CreateCustomerMealItemDto,
    user: JwtPayload,
  ) {
    return this.create(dto, user);
  }

  async updateCustomerMealItem(
    id: string,
    dto: UpdateCustomerMealItemDto,
    user: JwtPayload,
  ) {
    return this.update(id, dto, user);
  }

  async delete(id: string, user: JwtPayload): Promise<CustomerMealItem> {
    const item = await this.findOne(id);
    item.updatedBy = user.userId;
    await this.customerMealItemRepository.remove(item);
    return item;
  }
}
