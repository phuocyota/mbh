import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { CustomerMealItem } from '../../entities/customer-meal-item.entity';
import { MealItem } from '../../entities/meal-item.entity';
import { BaseService } from '../../common/sql/base.service';
import { JwtPayload } from '../../common/interface/jwt-payload.interface';
import { CreateCustomerMealItemDto } from './dto/create-customer-meal-item.dto';
import { SelectCustomerMealItemDto } from './dto/select-customer-meal-item.dto';
import { UpdateCustomerMealItemDto } from './dto/update-customer-meal-item.dto';
import { CustomerMealItemQueryDto } from './dto/customer-meal-item-query.dto';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';
import { COMMON_STATUS } from '../../common/constant/constant';

@Injectable()
export class CustomerMealItemService extends BaseService<CustomerMealItem> {
  constructor(
    @InjectRepository(CustomerMealItem)
    private customerMealItemRepository: Repository<CustomerMealItem>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(MealItem)
    private mealItemRepository: Repository<MealItem>,
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

  async selectForUser(
    userId: string | undefined,
    dto: SelectCustomerMealItemDto,
    user: JwtPayload,
  ) {
    if (!userId) {
      throw new BadRequestException('Missing user id');
    }

    const customer = await this.customerRepository.findOne({
      where: { userId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found for this user');
    }

    const mealItem = await this.mealItemRepository.findOne({
      where: { id: dto.mealItemId },
    });

    if (!mealItem) {
      throw new NotFoundException('Meal item not found');
    }

    return this.customerMealItemRepository.manager.transaction(
      async (manager) => {
        const customerMealItemRepo = manager.getRepository(CustomerMealItem);

        const slotQuery = customerMealItemRepo
          .createQueryBuilder('customerMealItem')
          .leftJoin('customerMealItem.mealItem', 'mealItem')
          .where('customerMealItem.customer_id = :customerId', {
            customerId: customer.id,
          })
          .andWhere('mealItem.branch_id = :branchId', {
            branchId: mealItem.branchId,
          })
          .andWhere('mealItem.meal_period = :mealPeriod', {
            mealPeriod: mealItem.mealPeriod,
          })
          .andWhere('mealItem.level = :level', { level: mealItem.level });

        if (mealItem.dateKey) {
          slotQuery.andWhere('mealItem.date_key = :dateKey', {
            dateKey: mealItem.dateKey,
          });
        } else {
          slotQuery.andWhere('mealItem.date_key IS NULL');
        }

        if (mealItem.dayOfWeek !== undefined && mealItem.dayOfWeek !== null) {
          slotQuery.andWhere('mealItem.day_of_week = :dayOfWeek', {
            dayOfWeek: mealItem.dayOfWeek,
          });
        } else {
          slotQuery.andWhere('mealItem.day_of_week IS NULL');
        }

        const existingSlotSelections = await slotQuery.getMany();
        const existingSelection = existingSlotSelections.find(
          (selection) => selection.mealItemId === mealItem.id,
        );

        existingSlotSelections
          .filter((selection) => selection.mealItemId !== mealItem.id)
          .forEach((selection) => {
            selection.status = COMMON_STATUS.INACTIVE;
            selection.updatedBy = user.userId;
          });

        if (existingSelection) {
          existingSelection.quantity = dto.quantity || 1;
          existingSelection.status = COMMON_STATUS.ACTIVE;
          existingSelection.note = dto.note;
          existingSelection.updatedBy = user.userId;
        }

        const selected = existingSelection
          ? existingSelection
          : customerMealItemRepo.create({
              customerId: customer.id,
              mealItemId: mealItem.id,
              quantity: dto.quantity || 1,
              status: COMMON_STATUS.ACTIVE,
              note: dto.note,
              createdBy: user.userId,
            });

        await customerMealItemRepo.save(
          existingSelection
            ? existingSlotSelections
            : [...existingSlotSelections, selected],
        );

        return customerMealItemRepo.findOne({
          where: { id: selected.id },
          relations: [
            'customer',
            'mealItem',
            'mealItem.branch',
            'mealItem.product',
            'mealItem.product.category',
          ],
        });
      },
    );
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
