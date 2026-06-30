import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  StockReceiptTransfer,
  Stock,
  StockItem,
  StockFundReceiptReason,
  Supplier,
  Debt,
} from '../../entities';
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
    @InjectRepository(StockReceiptImport)
    private stockReceiptImportRepository: Repository<StockReceiptImport>,
    @InjectRepository(StockReceiptExport)
    private stockReceiptExportRepository: Repository<StockReceiptExport>,
    @InjectRepository(StockReceiptTransfer)
    private stockReceiptTransferRepository: Repository<StockReceiptTransfer>,
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
    @InjectRepository(StockItem)
    private stockItemRepository: Repository<StockItem>,
    @InjectRepository(StockFundReceiptReason)
    private stockFundReceiptReasonRepository: Repository<StockFundReceiptReason>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    private financeService: FinanceService,
    private dataSource: DataSource,
  ) {}

  findAll() {
    return this.stockReceiptDetailRepository.find({
      relations: [
        'product',
        'importReceipt',
        'exportReceipt',
        'transferReceipt',
      ],
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
    const exportRepo = manager
      ? manager.getRepository(StockReceiptExport)
      : this.stockReceiptExportRepository;
    const existingExport = await exportRepo.findOne({
      where: { orderId: order.id },
    });
    if (existingExport) {
      return null;
    }

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

    const reason = await this.resolveReceiptReason(
      this.getSalesReasonCode(payment?.method),
      order.branchId,
      manager,
    );
    const fundId = payment?.fundId || reason?.fundId;
    const debitAccountCode = payment?.debitAccountCode || reason?.debitAccountCode;
    const creditAccountCode = payment?.creditAccountCode || reason?.creditAccountCode;

    return this.createVoucher(
      {
        branchId: order.branchId,
        type: 'EXPORT',
        orderId: order.id,
        fundId,
        debitAccountCode,
        creditAccountCode,
        note: `Xuất kho theo đơn hàng ${order.orderCode}`,
        items,
      },
      manager,
    );
  }

  private getSalesReasonCode(paymentMethod?: string) {
    const paymentMethodToReasonCode: Record<string, string> = {
      CASH: 'BH_CASH',
      BANK_TRANSFER: 'BH_BANK',
      QR: 'BH_BANK',
      MOMO: 'BH_BANK',
      WALLET: 'BH_WALLET',
      CARD: 'BH_CARD',
    };

    return paymentMethod ? paymentMethodToReasonCode[paymentMethod] : undefined;
  }

  private async resolveReceiptReason(
    code: string | undefined,
    branchId?: string,
    manager?: EntityManager,
  ) {
    if (!code) {
      return null;
    }

    const reasonRepo = manager
      ? manager.getRepository(StockFundReceiptReason)
      : this.stockFundReceiptReasonRepository;

    if (branchId) {
      const branchReason = await reasonRepo.findOne({
        where: {
          code,
          stock: { branchId },
        },
      });

      if (branchReason) {
        return branchReason;
      }
    }

    return reasonRepo.findOne({
      where: { code },
    });
  }

  private isPaidSupplierImport(dto: CreateStockVoucherDto) {
    const paymentStatus = String(dto.paymentStatus || '').toUpperCase();
    if (['DEBT', 'UNPAID', 'CREDIT'].includes(paymentStatus)) {
      return false;
    }

    return (
      !!dto.fundId ||
      dto.isPaid === true ||
      ['PAID', 'PAID_NOW', 'IMMEDIATE', 'CASH'].includes(paymentStatus)
    );
  }

  private async getOrCreateBranchStock(
    stockRepo: Repository<Stock>,
    branchId: string,
  ): Promise<Stock> {
    let stock = await stockRepo.findOne({ where: { branchId } });
    if (!stock) {
      stock = await stockRepo.save(
        stockRepo.create({
          name: `Kho Chi Nhánh`,
          branchId,
        }),
      );
    }
    return stock;
  }

  private async updateStockItemQuantity(
    stockItemRepo: Repository<StockItem>,
    stockId: string,
    productId: string,
    quantityChange: number,
  ) {
    let stockItem = await stockItemRepo.findOne({
      where: { stockId, productId },
    });

    if (!stockItem) {
      stockItem = stockItemRepo.create({
        stockId,
        productId,
        quantity: 0,
      });
    }

    stockItem.quantity = Number(stockItem.quantity) + Number(quantityChange);
    await stockItemRepo.save(stockItem);
  }

  async createVoucher(dto: CreateStockVoucherDto, manager?: EntityManager) {
    const executor = async (trx: EntityManager) => {
      const type = dto.type.toUpperCase();
      if (!['IMPORT', 'EXPORT', 'TRANSFER'].includes(type)) {
        throw new BadRequestException(
          'Stock voucher type must be IMPORT, EXPORT or TRANSFER',
        );
      }

      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Stock voucher items are required');
      }

      const detailRepo = trx.getRepository(StockReceiptDetail);
      const importRepo = trx.getRepository(StockReceiptImport);
      const exportRepo = trx.getRepository(StockReceiptExport);
      const transferRepo = trx.getRepository(StockReceiptTransfer);
      const stockRepo = trx.getRepository(Stock);
      const stockItemRepo = trx.getRepository(StockItem);
      const supplierRepo = trx.getRepository(Supplier);
      const debtRepo = trx.getRepository(Debt);

      const totalAmount = dto.items.reduce((sum, item) => {
        return sum + Number(item.quantity) * Number(item.unitPrice || 0);
      }, 0);

      const branchId = dto.branchId || DEFAULT_BRANCH_ID;
      let branchStock: Stock | null = null;
      let fromStock: Stock | null = null;
      let toStock: Stock | null = null;

      if (type === 'IMPORT' || type === 'EXPORT') {
        branchStock = await this.getOrCreateBranchStock(stockRepo, branchId);
      } else if (type === 'TRANSFER') {
        const fromBranchId = dto.fromBranchId || branchId;
        const toBranchId = dto.toBranchId;
        if (!toBranchId) {
          throw new BadRequestException(
            'Destination branch (toBranchId) is required for stock transfers',
          );
        }
        fromStock = await this.getOrCreateBranchStock(stockRepo, fromBranchId);
        toStock = await this.getOrCreateBranchStock(stockRepo, toBranchId);
      }

      let fundId = dto.fundId;
      let debitAccountCode = dto.debitAccountCode;
      let creditAccountCode = dto.creditAccountCode;

      const isPaidSupplierImport =
        type === 'IMPORT' &&
        !!dto.supplierId &&
        this.isPaidSupplierImport(dto);

      if (isPaidSupplierImport && !fundId) {
        const reason = await this.resolveReceiptReason('NHNCC', branchId, trx);
        fundId = reason?.fundId;
        debitAccountCode = debitAccountCode || reason?.debitAccountCode;
        creditAccountCode = creditAccountCode || reason?.creditAccountCode;
      }

      if (type === 'IMPORT' && dto.supplierId && !isPaidSupplierImport) {
        fundId = undefined;
      }

      let headerReceipt: StockReceiptImport | StockReceiptExport | StockReceiptTransfer;

      if (type === 'IMPORT') {
        const code = `NK${Date.now()}`;
        headerReceipt = await importRepo.save(
          importRepo.create({
            code,
            branchId,
            supplierId: dto.supplierId,
            orderId: dto.orderId,
            fundId,
            totalAmount,
            status: 'COMPLETED',
            note: dto.note,
          }),
        );
      } else if (type === 'EXPORT') {
        const code = `XK${Date.now()}`;
        headerReceipt = await exportRepo.save(
          exportRepo.create({
            code,
            branchId,
            orderId: dto.orderId,
            fundId,
            totalAmount,
            status: 'COMPLETED',
            note: dto.note,
          }),
        );
      } else {
        const code = `CK${Date.now()}`;
        headerReceipt = await transferRepo.save(
          transferRepo.create({
            code,
            fromBranchId: dto.fromBranchId || branchId,
            toBranchId: dto.toBranchId!,
            status: 'COMPLETED',
            receivedAt: new Date(),
            totalAmount,
            note: dto.note,
          }),
        );
      }

      const savedDetails: StockReceiptDetail[] = [];

      for (const dtoItem of dto.items) {
        const quantity = Number(dtoItem.quantity);
        const unitPrice = Number(dtoItem.unitPrice || 0);
        const total = quantity * unitPrice;

        let fromId: string | null = null;
        let toId: string | null = null;
        let fromType = 'STOCK';
        let toType = 'STOCK';

        if (type === 'IMPORT') {
          if (dto.fromBranchId) {
            const sourceStock = await this.getOrCreateBranchStock(
              stockRepo,
              dto.fromBranchId,
            );
            fromId = sourceStock.id;
            fromType = 'STOCK';
          } else {
            fromId = dto.supplierId || null;
            fromType = 'VENDOR';
          }
          toId = branchStock!.id;
          toType = 'STOCK';
        } else if (type === 'EXPORT') {
          fromId = branchStock!.id;
          fromType = 'STOCK';
          if (dto.toBranchId) {
            const destinationStock = await this.getOrCreateBranchStock(
              stockRepo,
              dto.toBranchId,
            );
            toId = destinationStock.id;
            toType = 'STOCK';
          } else {
            toId = dto.orderId || dto.supplierId || null;
            toType = 'VENDOR';
          }
        } else if (type === 'TRANSFER') {
          fromId = fromStock!.id;
          fromType = 'STOCK';
          toId = toStock!.id;
          toType = 'STOCK';
        }

        const detailData = {
          productId: dtoItem.productId,
          quantity,
          receiptType: type,
          fromId,
          toId,
          fromType,
          toType,
          importId: type === 'IMPORT' ? headerReceipt.id : undefined,
          exportId: type === 'EXPORT' ? headerReceipt.id : undefined,
          transferId: type === 'TRANSFER' ? headerReceipt.id : undefined,
        };

        const detail = await detailRepo.save(detailRepo.create(detailData as any) as any);
        savedDetails.push(detail);

        if (dtoItem.productId) {
          if (type === 'IMPORT') {
            await this.updateStockItemQuantity(stockItemRepo, toId!, dtoItem.productId, quantity);
          } else if (type === 'EXPORT') {
            await this.updateStockItemQuantity(stockItemRepo, fromId!, dtoItem.productId, -quantity);
          } else if (type === 'TRANSFER') {
            await this.updateStockItemQuantity(stockItemRepo, fromId!, dtoItem.productId, -quantity);
            await this.updateStockItemQuantity(stockItemRepo, toId!, dtoItem.productId, quantity);
          }
        }
      }

      if (type === 'IMPORT' && dto.supplierId && totalAmount > 0) {
        const supplier = await supplierRepo.findOne({
          where: { id: dto.supplierId },
        });
        if (!supplier) {
          throw new BadRequestException('Supplier not found');
        }

        supplier.totalPurchase = Number(supplier.totalPurchase || 0) + totalAmount;

        if (!isPaidSupplierImport) {
          const nextDebt = Number(supplier.debt || 0) + totalAmount;
          supplier.debt = nextDebt;

          await debtRepo.save(
            debtRepo.create({
              supplierId: supplier.id,
              type: 'PURCHASE',
              amount: totalAmount,
              balanceAfter: nextDebt,
              refType: ACCOUNTING_SOURCE_TYPE.STOCK_VOUCHER,
              refId: headerReceipt.id,
              note: dto.note,
            }),
          );
        }

        await supplierRepo.save(supplier);
      }

      if (
        fundId &&
        totalAmount > 0 &&
        (type === 'EXPORT' ||
          (type === 'IMPORT' && (!dto.supplierId || isPaidSupplierImport)))
      ) {
        const moneyVoucher = await this.financeService.createMoneyVoucher(
          {
            type:
              type === 'IMPORT'
                ? MONEY_VOUCHER_TYPE.PAYMENT
                : MONEY_VOUCHER_TYPE.RECEIPT,
            fundId,
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
            refId: dto.orderId || headerReceipt.id,
            note: dto.note,
            debitAccountCode,
            creditAccountCode,
          },
          trx,
        );

        if (moneyVoucher) {
          // Link money voucher to header
          if (type === 'IMPORT') {
            await importRepo.update(headerReceipt.id, { moneyVoucherId: moneyVoucher.id });
          } else if (type === 'EXPORT') {
            await exportRepo.update(headerReceipt.id, { moneyVoucherId: moneyVoucher.id });
          }
        }
      }

      return detailRepo.find({
        where: savedDetails.map((detail) => ({ id: detail.id })),
        relations: [
          'product',
          'importReceipt',
          'exportReceipt',
          'transferReceipt',
        ],
      });
    };

    if (manager) {
      return executor(manager);
    }

    return this.dataSource.transaction(executor);
  }
}
