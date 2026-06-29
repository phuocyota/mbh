import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../entities/category.entity';
import { StockItem } from '../../entities/stock-item.entity';
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
    filter: { minPrice?: number; maxPrice?: number; branchId?: string } = {},
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

    if (filter.branchId) {
      productConditions.push(`
        EXISTS (
          SELECT 1
          FROM stock_items stock_item
          INNER JOIN stocks stock ON stock.id = stock_item.stock_id
          WHERE stock_item.product_id = product.id
            AND stock.branch_id = :branchId
        )
      `);
      params.branchId = filter.branchId;
    }

    const categories = await this.categoryRepository
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

    if (!filter.branchId) {
      return categories;
    }

    const productIds = categories.flatMap((category) =>
      (category.products || []).map((product) => product.id),
    );

    if (!productIds.length) {
      return categories;
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

    categories.forEach((category) => {
      (category.products || []).forEach((product) => {
        (product as any).remain = stockByProductId.get(product.id) || 0;
      });
    });

    return categories;
  }
}
