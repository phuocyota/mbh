import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Product, Stock, StockItem } from '../../entities';
import { DEFAULT_BRANCH_ID } from '../../common/constant/default-branch.constant';

@Injectable()
export class InventoryItemService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(StockItem)
    private readonly stockItemRepository: Repository<StockItem>,
    private readonly dataSource: DataSource,
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
    const quantityByProductId = await this.getQuantityByProductIds(
      products.map((product) => product.id),
    );

    return products.map((product) =>
      this.toInventoryItem(product, quantityByProductId.get(product.id) || 0),
    );
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException(`Inventory item not found: ${id}`);
    }

    const quantityByProductId = await this.getQuantityByProductIds([product.id]);
    return this.toInventoryItem(
      product,
      quantityByProductId.get(product.id) || 0,
    );
  }

  async create(dto: any) {
    if (!dto.categoryId) {
      throw new BadRequestException('categoryId is required to create product-backed inventory item');
    }

    const product = await this.dataSource.transaction(async (trx) => {
      const productRepo = trx.getRepository(Product);
      const savedProduct = await productRepo.save(
        productRepo.create({
          categoryId: dto.categoryId,
          sku: dto.sku,
          name: dto.name,
          description: dto.notes,
          price: Number(dto.price || dto.costPerUnit || 0),
          costPrice: Number(dto.costPerUnit || 0),
          unit: dto.unit,
          isActive: dto.status ? dto.status === 'ACTIVE' : true,
        }),
      );

      if (dto.quantity !== undefined) {
        await this.setDefaultStockQuantity(
          trx,
          savedProduct.id,
          Number(dto.quantity || 0),
        );
      }

      return savedProduct;
    });

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
    if (dto.unit !== undefined) product.unit = dto.unit;
    if (dto.costPerUnit !== undefined) product.costPrice = Number(dto.costPerUnit);
    if (dto.price !== undefined) product.price = Number(dto.price);
    if (dto.categoryId !== undefined) product.categoryId = dto.categoryId;
    if (dto.status !== undefined) product.isActive = dto.status === 'ACTIVE';

    await this.dataSource.transaction(async (trx) => {
      await trx.getRepository(Product).save(product);

      if (dto.quantity !== undefined) {
        await this.setDefaultStockQuantity(
          trx,
          product.id,
          Number(dto.quantity || 0),
        );
      }
    });

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

  private toInventoryItem(product: Product, quantity: number) {
    return {
      id: product.id,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity,
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

  private async getQuantityByProductIds(productIds: string[]) {
    const quantityByProductId = new Map<string, number>();
    if (productIds.length === 0) {
      return quantityByProductId;
    }

    const rows = await this.stockItemRepository
      .createQueryBuilder('stockItem')
      .select('stockItem.productId', 'productId')
      .addSelect('COALESCE(SUM(stockItem.quantity), 0)', 'quantity')
      .where({ productId: In(productIds) })
      .groupBy('stockItem.productId')
      .getRawMany<{ productId: string; quantity: string }>();

    rows.forEach((row) => {
      quantityByProductId.set(row.productId, Number(row.quantity || 0));
    });

    return quantityByProductId;
  }

  private async getOrCreateDefaultStock(trx: EntityManager) {
    const stockRepo = trx.getRepository(Stock);
    let stock = await stockRepo.findOne({
      where: { branchId: DEFAULT_BRANCH_ID },
    });

    if (!stock) {
      stock = await stockRepo.save(
        stockRepo.create({
          name: 'Kho Chi Nhanh',
          branchId: DEFAULT_BRANCH_ID,
        }),
      );
    }

    return stock;
  }

  private async setDefaultStockQuantity(
    trx: EntityManager,
    productId: string,
    quantity: number,
  ) {
    const stock = await this.getOrCreateDefaultStock(trx);
    const stockItemRepo = trx.getRepository(StockItem);
    let stockItem = await stockItemRepo.findOne({
      where: { stockId: stock.id, productId },
    });

    if (!stockItem) {
      stockItem = stockItemRepo.create({
        stockId: stock.id,
        productId,
        quantity: 0,
      });
    }

    stockItem.quantity = quantity;
    await stockItemRepo.save(stockItem);
  }
}
