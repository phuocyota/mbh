import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../entities/category.entity';
import { BaseService } from '../../common/sql/base.service';
import { JwtPayload } from '../../common/interface/jwt-payload.interface';
import { COMMON_STATUS } from '../../common/constant/constant';

@Injectable()
export class CategoryService extends BaseService<Category> {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {
    super(categoryRepository);
  }

  protected getEntityName(): string {
    return 'Category';
  }

  async delete(id: string, user: JwtPayload): Promise<Category> {
    const item = await this.findOne(id);
    item.updatedBy = user.userId;
    await this.categoryRepository.remove(item);
    return item;
  }

  async findActive() {
    return this.categoryRepository.find({
      where: { status: COMMON_STATUS.ACTIVE },
      order: { sortOrder: 'ASC' },
    });
  }

  async findActiveWithProducts(
    filter: { minPrice?: number; maxPrice?: number } = {},
  ) {
    const productConditions = ['product.is_active = :isActive'];
    const params: Record<string, number | boolean | string> = {
      isActive: true,
    };

    if (filter.minPrice !== undefined) {
      productConditions.push('product.price >= :minPrice');
      params.minPrice = filter.minPrice;
    }

    if (filter.maxPrice !== undefined) {
      productConditions.push('product.price <= :maxPrice');
      params.maxPrice = filter.maxPrice;
    }

    return this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect(
        'category.products',
        'product',
        productConditions.join(' AND '),
        params,
      )
      .where('category.status = :status', { status: COMMON_STATUS.ACTIVE })
      .orderBy('category.sort_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .getMany();
  }
}
