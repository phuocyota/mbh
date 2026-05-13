import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Category } from 'src/entities';
import { BaseService } from '../../common/sql/base.service';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';

@Injectable()
export class ProductService extends BaseService<Product> {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {
    super(productRepository);
  }

  async findAll(categoryId?: string) {
    const query = this.productRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .where('p.is_active = :isActive', { isActive: true });

    if (categoryId) {
      query.andWhere('p.category_id = :categoryId', { categoryId });
    }

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
    return this.categoryRepository.find({
      where: { status: 'ACTIVE' },
      order: { sortOrder: 'ASC' },
    });
  }
}
