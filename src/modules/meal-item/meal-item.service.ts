import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealItem } from '../../entities/meal-item.entity';
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

    if (filter.status) {
      query.andWhere('mealItem.status = :status', { status: filter.status });
    }

    return query
      .orderBy('mealItem.meal_period', 'ASC')
      .addOrderBy('mealItem.sort_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .getMany();
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
