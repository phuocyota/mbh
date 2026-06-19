import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Product,
  StockReceiptDetail,
} from '../../entities';
import { calculateNextStock } from '../../../packages/inventory/src/index.js';
import { CreateStockVoucherDto } from './dto/create-stock-voucher.dto';
import { FinanceService } from '../finance/finance.service';
import { DEFAULT_BRANCH_ID } from '../../common/constant/default-branch.constant';
import {
  ACCOUNTING_PURPOSE,
  ACCOUNTING_SOURCE_TYPE,
  MONEY_VOUCHER_TYPE,
} from '../../../packages/accounting/src/index.js';

@Injectable()
export class StockVoucherService {
  constructor(
    @InjectRepository(StockReceiptDetail)
    private stockReceiptDetailRepository: Repository<StockReceiptDetail>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private financeService: FinanceService,
    private dataSource: DataSource,
  ) {}

  findAll() {
    return this.stockReceiptDetailRepository.find({
      relations: ['product', 'supplier', 'order', 'fund', 'moneyVoucher'],
      order: { createdAt: 'DESC' },
    });
  }

  createImportVoucher(dto: Omit<CreateStockVoucherDto, 'type'>) {
    return this.createVoucher({ ...dto, type: 'IMPORT' });
  }

  createExportVoucher(dto: Omit<CreateStockVoucherDto, 'type'>) {
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

  async createVoucher(dto: CreateStockVoucherDto, manager?: EntityManager) {
    const executor = async (trx: EntityManager) => {
      const type = dto.type.toUpperCase();
      if (!['IMPORT', 'EXPORT'].includes(type)) {
        throw new BadRequestException(
          'Stock voucher type must be IMPORT or EXPORT',
        );
      }

      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Stock voucher items are required');
      }

      const detailRepo = trx.getRepository(StockReceiptDetail);
      const productRepo = trx.getRepository(Product);

      const totalAmount = dto.items.reduce((sum, item) => {
        return sum + Number(item.quantity) * Number(item.unitPrice || 0);
      }, 0);

      const savedDetails: StockReceiptDetail[] = [];

      for (const dtoItem of dto.items) {
        const quantity = Number(dtoItem.quantity);
        const unitPrice = Number(dtoItem.unitPrice || 0);
        const total = quantity * unitPrice;

        const detail = await detailRepo.save(
          detailRepo.create({
            branchId: dto.branchId || DEFAULT_BRANCH_ID,
            productId: dtoItem.productId,
            supplierId: dto.supplierId,
            orderId: dto.orderId,
            fundId: dto.fundId,
            quantity,
            unitPrice,
            totalAmount: total,
            type,
            note: dtoItem.note || dto.note,
          }),
        );
        savedDetails.push(detail);

        if (dtoItem.productId) {
          await this.applyInventoryChange(
            productRepo,
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
                ? ACCOUNTING_PURPOSE.STOCK_IMPORT
                : ACCOUNTING_PURPOSE.STOCK_EXPORT,
            refType: dto.orderId
              ? ACCOUNTING_SOURCE_TYPE.ORDER
              : ACCOUNTING_SOURCE_TYPE.STOCK_RECEIPT_DETAIL,
            refId: dto.orderId || savedDetails[0]?.id,
            note: dto.note,
          },
          trx,
        );

        if (moneyVoucher) {
          await detailRepo.update(
            savedDetails.map((detail) => detail.id),
            { moneyVoucherId: moneyVoucher.id },
          );
        }
      }

      return detailRepo.find({
        where: savedDetails.map((detail) => ({ id: detail.id })),
        relations: ['product', 'supplier', 'order', 'fund', 'moneyVoucher'],
      });
    };

    if (manager) {
      return executor(manager);
    }

    return this.dataSource.transaction(executor);
  }

  private async applyInventoryChange(
    productRepo: Repository<Product>,
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
  }
}
