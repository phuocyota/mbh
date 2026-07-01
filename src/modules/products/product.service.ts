import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductPriceHistory } from 'src/entities';
import { StockItem } from '../../entities/stock-item.entity';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { CategoryService } from '../category/category.service';

type ProductPriceFilter = {
  minPrice?: number;
  maxPrice?: number;
  branchId?: string;
  isCanteenItem?: boolean;
  search?: string;
  displayStatus?: string;
  stockStatus?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class ProductService extends BaseService<Product> {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductPriceHistory)
    private productPriceHistoryRepository: Repository<ProductPriceHistory>,
    private categoryService: CategoryService,
  ) {
    super(productRepository);
  }

  async findProducts(categoryId?: string, filter: ProductPriceFilter = {}) {
    const page = filter.page || 1;
    const limit = filter.limit || 22;
    const skip = (page - 1) * limit;

    const query = this.productRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category');

    if (filter.displayStatus === 'active') {
      query.andWhere('p.is_active = :isActive', { isActive: true });
    } else if (filter.displayStatus === 'inactive') {
      query.andWhere('p.is_active = :isActive', { isActive: false });
    }

    if (filter.search) {
      query.andWhere(
        '(LOWER(p.name) LIKE LOWER(:search) OR LOWER(p.sku) LIKE LOWER(:search))',
        { search: `%${filter.search}%` }
      );
    }

    if (categoryId) {
      query.andWhere('p.category_id = :categoryId', { categoryId });
    }

    if (filter.branchId) {
      query.andWhere(
        `
        EXISTS (
          SELECT 1
          FROM stock_items stock_item
          INNER JOIN stocks stock ON stock.id = stock_item.stock_id
          WHERE stock_item.product_id = p.id
            AND stock.branch_id = :branchId
        )
      `,
        { branchId: filter.branchId },
      );
    }

    if (filter.stockStatus && filter.stockStatus !== 'all') {
      const branchIdCondition = filter.branchId ? `AND stock.branch_id = :branchId` : '';
      const stockSubquery = `
        (SELECT COALESCE(SUM(si.quantity), 0)
         FROM stock_items si
         INNER JOIN stocks stock ON stock.id = si.stock_id
         WHERE si.product_id = p.id ${branchIdCondition}
        )
      `;
      if (filter.stockStatus === 'inStock') query.andWhere(`${stockSubquery} > 0`);
      if (filter.stockStatus === 'outOfStock') query.andWhere(`${stockSubquery} <= 0`);
      if (filter.stockStatus === 'under') query.andWhere(`${stockSubquery} < 5`);
      if (filter.stockStatus === 'over') query.andWhere(`${stockSubquery} >= 5`);
    }

    if (filter.isCanteenItem !== undefined) {
      query.andWhere('p.is_canteen_item = :isCanteenItem', {
        isCanteenItem: filter.isCanteenItem,
      });
    }

    this.applyPriceFilter(query, 'p', filter);

    const [products, total] = await query
      .orderBy('category.sort_order', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    if (!filter.branchId || !products.length) {
      return {
        items: products,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const stockRows = await this.productRepository.manager
      .getRepository(StockItem)
      .createQueryBuilder('stockItem')
      .innerJoin('stockItem.stock', 'stock')
      .select('stockItem.productId', 'productId')
      .addSelect('SUM(stockItem.quantity)', 'quantity')
      .where('stock.branchId = :branchId', { branchId: filter.branchId })
      .andWhere('stockItem.productId IN (:...productIds)', {
        productIds: products.map((product) => product.id),
      })
      .groupBy('stockItem.productId')
      .getRawMany<{ productId: string; quantity: string }>();

    const stockByProductId = new Map(
      stockRows.map((row) => [row.productId, Number(row.quantity || 0)]),
    );

    products.forEach((product) => {
      (product as any).remain = stockByProductId.get(product.id) || 0;
    });

    return {
      items: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Product', id),
      );
    }

    return product;
  }

  async createProduct(createProductDto: any) {
    const productDto = this.withoutQuantity(createProductDto);
    productDto.price = productDto.price ?? 0;

    return this.productRepository.manager.transaction(async (manager) => {
      const productRepository = manager.getRepository(Product);
      const historyRepository = manager.getRepository(ProductPriceHistory);

      const product = productRepository.create({
        ...(productDto as Partial<Product>),
      });
      const savedProduct = await productRepository.save(product);

      await historyRepository.save(
        historyRepository.create({
          productId: savedProduct.id,
          oldPrice: null,
          newPrice: Number(savedProduct.price),
          oldCostPrice: null,
          newCostPrice:
            savedProduct.costPrice === null ||
            savedProduct.costPrice === undefined
              ? null
              : Number(savedProduct.costPrice),
          changeType: 'INITIAL',
          note: 'Initial price snapshot on product creation',
        }),
      );

      return savedProduct;
    });
  }

  async updateProduct(id: string, updateProductDto: any) {
    const productDto = this.withoutQuantity(updateProductDto);

    await this.productRepository.manager.transaction(async (manager) => {
      const productRepository = manager.getRepository(Product);
      const historyRepository = manager.getRepository(ProductPriceHistory);

      const product = await productRepository.findOne({ where: { id } });
      if (!product) {
        throw new NotFoundException(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID('Product', id),
        );
      }

      const oldPrice = Number(product.price);
      const oldCostPrice =
        product.costPrice === null || product.costPrice === undefined
          ? null
          : Number(product.costPrice);

      Object.assign(product, productDto);
      const savedProduct = await productRepository.save(product);

      await this.recordPriceHistoryIfChanged(historyRepository, {
        productId: savedProduct.id,
        oldPrice,
        newPrice: Number(savedProduct.price),
        oldCostPrice,
        newCostPrice:
          savedProduct.costPrice === null ||
          savedProduct.costPrice === undefined
            ? null
            : Number(savedProduct.costPrice),
        changeType: 'UPDATE',
      });
    });

    return this.findOne(id);
  }

  async updateBulk(
    items: { id: string; price: number }[],
    updatedBy?: { userId: string },
  ) {
    const updatedIds: string[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const item of items) {
      try {
        const product = await this.productRepository.findOne({
          where: { id: item.id },
        });

        if (!product) {
          errors.push({ id: item.id, error: 'Product not found' });
          continue;
        }

        const oldPrice = Number(product.price);
        const oldCostPrice =
          product.costPrice === null || product.costPrice === undefined
            ? null
            : Number(product.costPrice);

        product.price = item.price;
        if (updatedBy) {
          product.updatedBy = updatedBy.userId;
        }
        const savedProduct = await this.productRepository.save(product);
        await this.recordPriceHistoryIfChanged(
          this.productPriceHistoryRepository,
          {
            productId: savedProduct.id,
            oldPrice,
            newPrice: Number(savedProduct.price),
            oldCostPrice,
            newCostPrice:
              savedProduct.costPrice === null ||
              savedProduct.costPrice === undefined
                ? null
                : Number(savedProduct.costPrice),
            changeType: 'UPDATE',
            createdBy: updatedBy?.userId,
          },
        );
        updatedIds.push(item.id);
      } catch (error) {
        errors.push({ id: item.id, error: error.message });
      }
    }

    return {
      success: updatedIds.length,
      failed: errors.length,
      updatedIds,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async deactivateProduct(id: string) {
    return this.productRepository.update(id, { isActive: false });
  }

  async delete(id: string, user: { userId: string }): Promise<Product> {
    const product = await this.findOne(id);
    const queryRunner = this.productRepository.manager.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`DELETE FROM meal_items WHERE product_id = $1`, [id]);
      await queryRunner.query(`DELETE FROM order_items WHERE product_id = $1`, [id]);
      await queryRunner.query(`DELETE FROM stock_receipt_detail WHERE product_id = $1`, [id]);
      await queryRunner.query(`DELETE FROM stock_items WHERE product_id = $1`, [id]);
      await queryRunner.query(`DELETE FROM stock_take_items WHERE product_id = $1`, [id]);
      await queryRunner.query(`DELETE FROM product_price_history WHERE product_id = $1`, [id]);
      await queryRunner.query(`DELETE FROM cart_items WHERE product_id = $1`, [id]);

      await queryRunner.query(`DELETE FROM products WHERE id = $1`, [id]);

      await queryRunner.commitTransaction();
      return product;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllCategories() {
    return this.categoryService.findActive();
  }

  async findAllCategoriesWithProducts(filter: ProductPriceFilter = {}) {
    return this.categoryService.findActiveWithProducts(filter);
  }

  private applyPriceFilter(
    query: ReturnType<Repository<Product>['createQueryBuilder']>,
    alias: string,
    filter: ProductPriceFilter,
  ) {
    if (filter.minPrice !== undefined) {
      query.andWhere(`${alias}.price >= :minPrice`, {
        minPrice: filter.minPrice,
      });
    }

    if (filter.maxPrice !== undefined) {
      query.andWhere(`${alias}.price <= :maxPrice`, {
        maxPrice: filter.maxPrice,
      });
    }
  }

  private withoutQuantity(dto: any) {
    const productDto = { ...dto };
    delete productDto.quantity;
    return productDto;
  }

  private async recordPriceHistoryIfChanged(
    historyRepository: Repository<ProductPriceHistory>,
    data: {
      productId: string;
      oldPrice: number | null;
      newPrice: number | null;
      oldCostPrice: number | null;
      newCostPrice: number | null;
      changeType: string;
      createdBy?: string;
    },
  ) {
    const priceChanged =
      this.toNullableNumber(data.oldPrice) !==
      this.toNullableNumber(data.newPrice);
    const costPriceChanged =
      this.toNullableNumber(data.oldCostPrice) !==
      this.toNullableNumber(data.newCostPrice);

    if (!priceChanged && !costPriceChanged) {
      return;
    }

    await historyRepository.save(
      historyRepository.create({
        productId: data.productId,
        oldPrice: data.oldPrice,
        newPrice: Number(data.newPrice),
        oldCostPrice: data.oldCostPrice,
        newCostPrice: data.newCostPrice,
        changeType: data.changeType,
        createdBy: data.createdBy,
      }),
    );
  }

  private toNullableNumber(value: number | null | undefined) {
    return value === null || value === undefined ? null : Number(value);
  }
}
