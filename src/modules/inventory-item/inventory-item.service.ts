import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities';

@Injectable()
export class InventoryItemService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(search?: string) {
    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.is_active = :isActive', { isActive: true });

    if (search?.trim()) {
      query.andWhere(
        '(LOWER(product.name) LIKE :search OR LOWER(product.sku) LIKE :search)',
        { search: `%${search.trim().toLowerCase()}%` },
      );
    }

    const products = await query.orderBy('product.name', 'ASC').getMany();
    return products.map((product) => this.toInventoryItem(product));
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException(`Inventory item not found: ${id}`);
    }

    return this.toInventoryItem(product);
  }

  async create(dto: any) {
    if (!dto.categoryId) {
      throw new BadRequestException('categoryId is required to create product-backed inventory item');
    }

    const product = await this.productRepository.save(
      this.productRepository.create({
        categoryId: dto.categoryId,
        sku: dto.sku,
        name: dto.name,
        description: dto.notes,
        price: Number(dto.price || dto.costPerUnit || 0),
        costPrice: Number(dto.costPerUnit || 0),
        quantity: Number(dto.quantity || 0),
        unit: dto.unit,
        isActive: dto.status ? dto.status === 'ACTIVE' : true,
      }),
    );

    return this.findOne(product.id);
  }

  async update(id: string, dto: any) {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Inventory item not found: ${id}`);
    }

    if (dto.sku !== undefined) product.sku = dto.sku;
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.notes !== undefined) product.description = dto.notes;
    if (dto.quantity !== undefined) product.quantity = Number(dto.quantity);
    if (dto.unit !== undefined) product.unit = dto.unit;
    if (dto.costPerUnit !== undefined) product.costPrice = Number(dto.costPerUnit);
    if (dto.price !== undefined) product.price = Number(dto.price);
    if (dto.categoryId !== undefined) product.categoryId = dto.categoryId;
    if (dto.status !== undefined) product.isActive = dto.status === 'ACTIVE';

    await this.productRepository.save(product);
    return this.findOne(id);
  }

  async delete(id: string) {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Inventory item not found: ${id}`);
    }

    product.isActive = false;
    await this.productRepository.save(product);
  }

  private toInventoryItem(product: Product) {
    return {
      id: product.id,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity: Number(product.quantity || 0),
      unit: product.unit,
      costPerUnit: Number(product.costPrice || 0),
      price: Number(product.price || 0),
      status: product.isActive ? 'ACTIVE' : 'INACTIVE',
      notes: product.description,
      categoryId: product.categoryId,
      categoryName: product.category?.name || null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
