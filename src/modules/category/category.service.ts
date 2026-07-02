import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Category } from '../../entities/category.entity';
import { StockItem } from '../../entities/stock-item.entity';
import { BaseService } from '../../common/sql/base.service';
import { JwtPayload } from '../../common/interface/jwt-payload.interface';
import { COMMON_STATUS } from '../../common/constant/constant';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';

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

  async findAll(page?: any, size?: any, branchId?: string) {
    const pagination = normalizePagination(page, size);
    const where: FindOptionsWhere<Category> = {};

    if (branchId) {
      where.branchId = branchId;
    } else {
      where.branchId = IsNull();
    }

    const [data, total] = await this.categoryRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC' },
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async delete(id: string, user: JwtPayload): Promise<Category> {
    const item = await this.findOne(id);
    item.updatedBy = user.userId;
    await this.categoryRepository.remove(item);
    return item;
  }

  async findActive(
    page?: number | string,
    size?: number | string,
    branchId?: string,
  ) {
    const pagination = normalizePagination(page, size);
    const where: FindOptionsWhere<Category> = {
      status: COMMON_STATUS.ACTIVE,
    };

    if (branchId) {
      where.branchId = branchId;
    } else {
      where.branchId = IsNull();
    }

    const [data, total] = await this.categoryRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC' },
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async findActiveWithProducts(
    filter: {
      minPrice?: number;
      maxPrice?: number;
      branchId?: string;
      isCanteenItem?: boolean;
      page?: number | string;
      size?: number | string;
    } = {},
  ) {
    const pagination = normalizePagination(filter.page, filter.size);
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

    if (filter.isCanteenItem !== undefined) {
      productConditions.push('product.is_canteen_item = :isCanteenItem');
      params.isCanteenItem = filter.isCanteenItem;
    }

    if (filter.branchId) {
      productConditions.push('product.branch_id = :branchId');
      params.branchId = filter.branchId;
    } else {
      productConditions.push('product.branch_id IS NULL');
    }

    const query = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect(
        'category.products',
        'product',
        productConditions.join(' AND '),
        params,
      )
      .where('category.status = :status', { status: COMMON_STATUS.ACTIVE });

    if (filter.branchId) {
      query.andWhere('category.branch_id = :branchId', {
        branchId: filter.branchId,
      });
    } else {
      query.andWhere('category.branch_id IS NULL');
    }

    const categories = await query
      .orderBy('category.sort_order', 'ASC')
      .addOrderBy('product.name', 'ASC')
      .getMany();

    const categoriesWithProducts = categories.filter(
      (category) => (category.products || []).length > 0,
    );
    const paginatedCategories = categoriesWithProducts.slice(
      pagination.skip,
      pagination.skip + pagination.size,
    );

    if (!filter.branchId) {
      return toPaginationResponse(
        paginatedCategories,
        categoriesWithProducts.length,
        pagination.page,
        pagination.size,
      );
    }

    const productIds = paginatedCategories.flatMap((category) =>
      (category.products || []).map((product) => product.id),
    );

    if (!productIds.length) {
      return toPaginationResponse(
        paginatedCategories,
        categoriesWithProducts.length,
        pagination.page,
        pagination.size,
      );
    }

    const stockRows = await this.categoryRepository.manager
      .getRepository(StockItem)
      .createQueryBuilder('stockItem')
      .innerJoin('stockItem.stock', 'stock')
      .select('stockItem.productId', 'productId')
      .addSelect('SUM(stockItem.quantity)', 'quantity')
      .where('stock.branchId = :branchId', { branchId: filter.branchId })
      .andWhere('stockItem.productId IN (:...productIds)', { productIds })
      .groupBy('stockItem.productId')
      .getRawMany<{ productId: string; quantity: string }>();

    const stockByProductId = new Map(
      stockRows.map((row) => [row.productId, Number(row.quantity || 0)]),
    );

    paginatedCategories.forEach((category) => {
      (category.products || []).forEach((product) => {
        (product as any).remain = stockByProductId.get(product.id) || 0;
      });
    });

    return toPaginationResponse(
      paginatedCategories,
      categoriesWithProducts.length,
      pagination.page,
      pagination.size,
    );
  }
}
