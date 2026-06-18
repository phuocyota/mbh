import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Product,
  StockTransaction,
  WarehouseVoucher,
  WarehouseVoucherItem,
} from '../../entities';
import { calculateNextStock } from '../../../packages/inventory/src/index.js';
import { CreateWarehouseVoucherDto } from './dto/create-warehouse-voucher.dto';
import { FinanceService } from '../finance/finance.service';
import { DEFAULT_BRANCH_ID } from '../../common/constant/default-branch.constant';
import {
  ACCOUNTING_PURPOSE,
  ACCOUNTING_SOURCE_TYPE,
  MONEY_VOUCHER_TYPE,
} from '../../../packages/accounting/src/index.js';

@Injectable()
export class WarehouseVoucherService {
  constructor(
    @InjectRepository(WarehouseVoucher)
    private warehouseVoucherRepository: Repository<WarehouseVoucher>,
    @InjectRepository(WarehouseVoucherItem)
    private warehouseVoucherItemRepository: Repository<WarehouseVoucherItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(StockTransaction)
    private stockTransactionRepository: Repository<StockTransaction>,
    private financeService: FinanceService,
    private dataSource: DataSource,
  ) {}

  findAll() {
    return this.warehouseVoucherRepository.find({
      relations: ['items', 'supplier', 'order'],
    });
  }

  createImportVoucher(dto: Omit<CreateWarehouseVoucherDto, 'type'>) {
    return this.createVoucher({ ...dto, type: 'IMPORT' });
  }

  createExportVoucher(dto: Omit<CreateWarehouseVoucherDto, 'type'>) {
    return this.createVoucher({ ...dto, type: 'EXPORT' });
  }

  async createExportFromOrder(
    order: any,
    payment: any,
    manager?: EntityManager,
  ) {
    const items = Array.isArray(order.items)
      ? order.items.map((item: any) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice || 0),
          note: item.productName,
        }))
      : [];

    if (items.length === 0) {
      return null;
    }

    return this.createVoucher(
      {
        branchId: order.branchId,
        type: 'EXPORT',
        orderId: order.id,
        fundId: payment?.fundId,
        note: `Xuất kho theo đơn hàng ${order.orderCode}`,
        items,
      },
      manager,
    );
  }

  async createVoucher(dto: CreateWarehouseVoucherDto, manager?: EntityManager) {
    const executor = async (trx: EntityManager) => {
      const type = dto.type.toUpperCase();
      if (!['IMPORT', 'EXPORT'].includes(type)) {
        throw new BadRequestException(
          'Warehouse voucher type must be IMPORT or EXPORT',
        );
      }

      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Warehouse voucher items are required');
      }

      const voucherRepo = trx.getRepository(WarehouseVoucher);
      const itemRepo = trx.getRepository(WarehouseVoucherItem);
      const productRepo = trx.getRepository(Product);
      const stockTransactionRepo = trx.getRepository(StockTransaction);

      const totalAmount = dto.items.reduce((sum, item) => {
        return sum + Number(item.quantity) * Number(item.unitPrice || 0);
      }, 0);

      const voucher = await voucherRepo.save(
        voucherRepo.create({
          branchId: dto.branchId || DEFAULT_BRANCH_ID,
          code: `${type === 'IMPORT' ? 'PN' : 'PX'}${Date.now()}`,
          type,
          supplierId: dto.supplierId,
          orderId: dto.orderId,
          totalAmount,
          fundId: dto.fundId,
          note: dto.note,
        }),
      );

      for (const dtoItem of dto.items) {
        const quantity = Number(dtoItem.quantity);
        const unitPrice = Number(dtoItem.unitPrice || 0);
        const total = quantity * unitPrice;

        await itemRepo.save(
          itemRepo.create({
            voucherId: voucher.id,
            productId: dtoItem.productId,
            quantity,
            unitPrice,
            totalAmount: total,
            note: dtoItem.note,
          }),
        );

        if (dtoItem.productId) {
          await this.applyInventoryChange(
            trx,
            productRepo,
            stockTransactionRepo,
            voucher,
            dtoItem.productId,
            quantity,
            type,
          );
        }
      }

      if (dto.fundId && totalAmount > 0) {
        const moneyVoucher = await this.financeService.createMoneyVoucher(
          {
            type:
              type === 'IMPORT'
                ? MONEY_VOUCHER_TYPE.PAYMENT
                : MONEY_VOUCHER_TYPE.RECEIPT,
            fundId: dto.fundId,
            amount: totalAmount,
            orderId: dto.orderId,
            supplierId: dto.supplierId,
            purpose:
              type === 'IMPORT'
                ? ACCOUNTING_PURPOSE.WAREHOUSE_IMPORT
                : ACCOUNTING_PURPOSE.WAREHOUSE_EXPORT,
            refType: ACCOUNTING_SOURCE_TYPE.WAREHOUSE_VOUCHER,
            refId: voucher.id,
            note: dto.note,
          },
          trx,
        );

        if (moneyVoucher) {
          voucher.moneyVoucherId = moneyVoucher.id;
          await voucherRepo.save(voucher);
        }
      }

      return voucherRepo.findOne({
        where: { id: voucher.id },
        relations: ['items', 'supplier', 'order'],
      });
    };

    if (manager) {
      return executor(manager);
    }

    return this.dataSource.transaction(executor);
  }

  private async applyInventoryChange(
    trx: EntityManager,
    productRepo: Repository<Product>,
    stockTransactionRepo: Repository<StockTransaction>,
    voucher: WarehouseVoucher,
    productId: string,
    quantity: number,
    type: string,
  ) {
    const product = await productRepo.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }

    const nextQuantity = calculateNextStock(
      product,
      quantity,
      type,
    );

    product.quantity = nextQuantity;
    await productRepo.save(product);

    await stockTransactionRepo.save(
      stockTransactionRepo.create({
        branchId: voucher.branchId,
        productId,
        type,
        quantity,
        refType: type === 'IMPORT' ? 'IMPORT_NOTE' : 'EXPORT_NOTE',
        refId: voucher.id,
        note: voucher.note,
      }),
    );
  }
}
