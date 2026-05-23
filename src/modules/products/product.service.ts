import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from 'src/entities';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { CategoryService } from '../category/category.service';

type ProductPriceFilter = {
  minPrice?: number;
  maxPrice?: number;
};

@Injectable()
export class ProductService extends BaseService<Product> {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private categoryService: CategoryService,
  ) {
    super(productRepository);
  }

  async findAll(categoryId?: string, filter: ProductPriceFilter = {}) {
    const query = this.productRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .where('p.is_active = :isActive', { isActive: true });

    if (categoryId) {
      query.andWhere('p.category_id = :categoryId', { categoryId });
    }

    this.applyPriceFilter(query, 'p', filter);

    return query
      .orderBy('category.sort_order', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .getMany();
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
    const product = this.productRepository.create(createProductDto);
    return this.productRepository.save(product);
  }

  async updateProduct(id: string, updateProductDto: any) {
    await this.productRepository.update(id, updateProductDto);
    return this.findOne(id);
  }

  async deactivateProduct(id: string) {
    return this.productRepository.update(id, { isActive: false });
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
}
