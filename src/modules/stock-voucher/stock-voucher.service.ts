import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { parseAccountingFormula } from '../../common/utils/accounting-formula.utils';
import {
  StockReceiptDetail,
  StockReceiptImport,
  StockReceiptExport,
  StockReceiptTransfer,
  Stock,
  StockItem,
  StockFundReceiptReason,
  Fund,
  MoneyVoucher,
  FundReceiptPaid,
  FundReceiptReceived,
} from '../../entities';
import { CreateStockVoucherDto } from './dto/create-stock-voucher.dto';
import {
  STOCK_PARTY_TYPE,
  STOCK_PAYMENT_STATUS,
  STOCK_VOUCHER_STATUS,
  STOCK_VOUCHER_TYPE,
} from './stock-voucher.constants';
import { FinanceService } from '../finance/finance.service';
import { SupplierService } from '../supplier/supplier.service';
import { StockService } from '../stock/stock.service';
import { DEFAULT_BRANCH_ID } from '../../common/constant/default-branch.constant';
import { PAYMENT_METHOD } from '../../common/constant/constant';
import {
  ACCOUNTING_PURPOSE,
  ACCOUNTING_SOURCE_TYPE,
  MONEY_VOUCHER_TYPE,
} from '../../../packages/accounting/src/index.js';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

const DEFERRED_SALE_REASON_CODE = 'BH_TRA_CHAM';
const SUPPLIER_IMPORT_REASON_CODE = 'NHNCC';

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
    @InjectRepository(StockFundReceiptReason)
    private stockFundReceiptReasonRepository: Repository<StockFundReceiptReason>,
    @InjectRepository(StockItem)
    private stockItemRepository: Repository<StockItem>,
    @InjectRepository(Fund)
    private fundRepository: Repository<Fund>,
    @InjectRepository(MoneyVoucher)
    private moneyVoucherRepository: Repository<MoneyVoucher>,
    @InjectRepository(FundReceiptPaid)
    private fundReceiptPaidRepository: Repository<FundReceiptPaid>,
    @InjectRepository(FundReceiptReceived)
    private fundReceiptReceivedRepository: Repository<FundReceiptReceived>,
    private supplierService: SupplierService,
    private financeService: FinanceService,
    private stockService: StockService,
  ) {}

  async findAll(
    page?: number | string,
    size?: number | string,
    branchId?: string,
  ) {
    const pagination = normalizePagination(page, size);
    const query = this.stockReceiptDetailRepository
      .createQueryBuilder('detail')
      .leftJoinAndSelect('detail.product', 'product')
      .leftJoinAndSelect('detail.importReceipt', 'importReceipt')
      .leftJoinAndSelect('detail.exportReceipt', 'exportReceipt')
      .leftJoinAndSelect('detail.transferReceipt', 'transferReceipt')
      .orderBy('detail.createdAt', 'DESC')
      .skip(pagination.skip)
      .take(pagination.size);

    if (branchId) {
      query.andWhere(
        `(
          importReceipt.branchId = :branchId
          OR exportReceipt.branchId = :branchId
          OR transferReceipt.fromBranchId = :branchId
          OR transferReceipt.toBranchId = :branchId
        )`,
        { branchId },
      );
    }

    const [data, total] = await query.getManyAndCount();
    const hydratedData = await this.attachMoneyVouchers(data);

    return toPaginationResponse(
      hydratedData,
      total,
      pagination.page,
      pagination.size,
    );
  }

  createImportVoucher(dto: Omit<CreateStockVoucherDto, 'type'>) {
    return this.createVoucher({ ...dto, type: STOCK_VOUCHER_TYPE.IMPORT });
  }

  createExportVoucher(dto: Omit<CreateStockVoucherDto, 'type'>) {
    return this.createVoucher({ ...dto, type: STOCK_VOUCHER_TYPE.EXPORT });
  }

  async createExportFromOrder(order: any, payment: any) {
    const existingExport = await this.stockReceiptExportRepository.findOne({
      where: { referenceId: order.id, referenceType: 'order' },
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

    const isCustomerAdvanceOffset = this.isCustomerAdvanceOffset(
      order,
      payment,
    );
    const reasonCode = isCustomerAdvanceOffset
      ? DEFERRED_SALE_REASON_CODE
      : this.getSalesReasonCode(payment?.method);

    return this.createVoucher({
      branchId: order.branchId,
      type: STOCK_VOUCHER_TYPE.EXPORT,
      sourceId: order.customerId,
      sourceType: order.customerId ? STOCK_PARTY_TYPE.CUSTOMER : undefined,
      referenceId: order.id,
      referenceType: 'order',
      fundId: isCustomerAdvanceOffset ? undefined : payment?.fundId,
      reasonCode,
      note: `Xuất kho theo đơn hàng ${order.orderCode}`,
      items,
    });
  }

  private isCustomerAdvanceOffset(order: any, payment: any) {
    if (payment?.method !== PAYMENT_METHOD.WALLET) {
      return false;
    }

    const paidAmount = Number(payment?.amount || 0);
    const totalAmount = Number(order?.totalAmount || 0);

    return (
      Number.isFinite(paidAmount) &&
      Number.isFinite(totalAmount) &&
      totalAmount > 0 &&
      paidAmount === totalAmount
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

  private async resolveReceiptReason(code: string | undefined) {
    if (!code) {
      return null;
    }

    return this.stockFundReceiptReasonRepository.findOne({
      where: { code },
    });
  }

  private async resolveSupplierImportReason(
    dto: CreateStockVoucherDto,
    isDebt: boolean,
  ) {
    const reasonCode = dto.reasonCode || SUPPLIER_IMPORT_REASON_CODE;
    const reason = await this.stockFundReceiptReasonRepository.findOne({
      where: {
        code: reasonCode,
        isDebt,
        status: 'active',
      },
    });

    if (!reason) {
      throw new BadRequestException(
        `Active supplier import reason is not configured: code=${reasonCode}, isDebt=${isDebt}`,
      );
    }

    return reason;
  }

  private async resolveFundFromReasonFormula(
    reason: StockFundReceiptReason,
    branchId: string,
  ) {
    const formulaEntries = parseAccountingFormula(reason.accountingFormula);
    const accountCodes = [
      ...new Set(formulaEntries.map((entry) => entry.accountCode)),
    ];

    if (accountCodes.length === 0) {
      throw new BadRequestException(
        `Accounting formula is required for reason: ${reason.code}`,
      );
    }

    const funds = await this.fundRepository.find({
      where: {
        code: In(accountCodes),
        branchId,
        status: 'active',
      },
    });

    if (funds.length !== 1) {
      throw new BadRequestException(
        `Exactly one active fund must match reason ${reason.code} in branch ${branchId}`,
      );
    }

    return funds[0];
  }

  private getSourceId(dto: CreateStockVoucherDto) {
    return dto.sourceId || dto.toId || null;
  }

  private getSourceType(dto: CreateStockVoucherDto) {
    return (dto.sourceType || dto.toType || '').toUpperCase() || null;
  }

  private isPaidSupplierImport(dto: CreateStockVoucherDto) {
    const paymentStatus = String(dto.paymentStatus || '').toUpperCase();
    if (paymentStatus === STOCK_PAYMENT_STATUS.PAID) {
      return true;
    }

    if (
      [STOCK_PAYMENT_STATUS.UNPAID, STOCK_PAYMENT_STATUS.DEBT].includes(
        paymentStatus as any,
      )
    ) {
      return false;
    }

    throw new BadRequestException(
      'paymentStatus must be PAID, UNPAID or DEBT for supplier import',
    );
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

  private async incrementStockItemsBulk(
    stockItemRepo: Repository<StockItem>,
    stockId: string,
    items: Array<{ productId: string; quantity: number }>,
  ) {
    if (items.length === 0) {
      return;
    }

    await stockItemRepo
      .createQueryBuilder()
      .insert()
      .into(StockItem)
      .values(
        items.map((item) => ({
          stockId,
          productId: item.productId,
          quantity: item.quantity,
        })),
      )
      .onConflict(
        '("stock_id", "product_id") DO UPDATE SET "quantity" = "stock_items"."quantity" + EXCLUDED."quantity"',
      )
      .execute();
  }

  private async createSupplierImportVoucher(
    dto: CreateStockVoucherDto,
    params: {
      branchId: string;
      sourceId: string;
      sourceType: string;
    },
  ) {
    const { branchId, sourceId, sourceType } = params;
    const totalAmount = dto.items.reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.unitPrice || 0);
    }, 0);
    const isPaid = this.isPaidSupplierImport(dto);
    const reason = await this.resolveSupplierImportReason(dto, !isPaid);
    const paymentStatus = isPaid
      ? STOCK_PAYMENT_STATUS.PAID
      : STOCK_PAYMENT_STATUS.DEBT;
    const branchStock =
      await this.stockService.getOrCreateBranchStock(branchId);
    const resolvedFund = isPaid
      ? await this.resolveFundFromReasonFormula(reason, branchId)
      : null;

    const headerReceipt = await this.stockReceiptImportRepository.save(
      this.stockReceiptImportRepository.create({
        code: `NK${Date.now()}`,
        branchId,
        fromId: sourceId,
        fromType: sourceType,
        referenceId: dto.referenceId,
        referenceType: dto.referenceType,
        reasonCode: reason.code,
        paymentStatus,
        totalAmount,
        status: STOCK_VOUCHER_STATUS.COMPLETED,
        note: dto.note,
      }),
    );

    const detailEntities = this.stockReceiptDetailRepository.create(
      dto.items.map((dtoItem) => ({
        productId: dtoItem.productId,
        quantity: Number(dtoItem.quantity),
        receiptType: STOCK_VOUCHER_TYPE.IMPORT,
        fromId: sourceId,
        toId: branchId,
        fromType: sourceType,
        toType: STOCK_PARTY_TYPE.BRANCH,
        importId: headerReceipt.id,
      })),
    );
    const savedDetails =
      await this.stockReceiptDetailRepository.save(detailEntities);

    await this.incrementStockItemsBulk(
      this.stockItemRepository,
      branchStock.id,
      dto.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      })),
    );

    if (totalAmount > 0) {
      if (isPaid) {
        await this.supplierService.recordPurchase(sourceId, totalAmount);
        await this.financeService.createMoneyVoucher({
          type: MONEY_VOUCHER_TYPE.PAYMENT,
          fundId: resolvedFund!.id,
          amount: totalAmount,
          supplierId: sourceId,
          purpose: ACCOUNTING_PURPOSE.STOCK_IMPORT,
          reasonCode: reason.code,
          refType: ACCOUNTING_SOURCE_TYPE.STOCK_VOUCHER,
          refId: headerReceipt.id,
          note: dto.note,
        });
      } else {
        await this.supplierService.recordPurchaseDebt({
          supplierId: sourceId,
          amount: totalAmount,
          refType: ACCOUNTING_SOURCE_TYPE.STOCK_VOUCHER,
          refId: headerReceipt.id,
          note: dto.note,
        });
      }
    }

    const result = await this.stockReceiptDetailRepository.find({
      where: savedDetails.map((detail) => ({ id: detail.id })),
      relations: ['product', 'importReceipt'],
    });

    return this.attachMoneyVouchers(result);
  }

  private async attachMoneyVouchers(details: StockReceiptDetail[]) {
    const importReceiptIds = [
      ...new Set(
        details
          .map((detail) => detail.importReceipt?.id || detail.importId)
          .filter((id): id is string => !!id),
      ),
    ];
    const exportReceiptIds = [
      ...new Set(
        details
          .map((detail) => detail.exportReceipt?.id || detail.exportId)
          .filter((id): id is string => !!id),
      ),
    ];
    const exportOrderIds = [
      ...new Set(
        details
          .map((detail) =>
            detail.exportReceipt?.referenceType === 'order'
              ? detail.exportReceipt.referenceId
              : null,
          )
          .filter((id): id is string => !!id),
      ),
    ];

    if (
      !importReceiptIds.length &&
      !exportReceiptIds.length &&
      !exportOrderIds.length
    ) {
      return details;
    }

    const voucherWhere = [
      ...(importReceiptIds.length
        ? [
            {
              type: MONEY_VOUCHER_TYPE.PAYMENT,
              refType: ACCOUNTING_SOURCE_TYPE.STOCK_VOUCHER,
              refId: In(importReceiptIds),
            },
            {
              type: MONEY_VOUCHER_TYPE.PAYMENT,
              refType: ACCOUNTING_SOURCE_TYPE.STOCK_RECEIPT_DETAIL,
              refId: In(importReceiptIds),
            },
          ]
        : []),
      ...(exportReceiptIds.length
        ? [
            {
              type: MONEY_VOUCHER_TYPE.RECEIPT,
              refType: ACCOUNTING_SOURCE_TYPE.STOCK_VOUCHER,
              refId: In(exportReceiptIds),
            },
            {
              type: MONEY_VOUCHER_TYPE.RECEIPT,
              refType: ACCOUNTING_SOURCE_TYPE.STOCK_RECEIPT_DETAIL,
              refId: In(exportReceiptIds),
            },
          ]
        : []),
      ...(exportOrderIds.length
        ? [
            {
              type: MONEY_VOUCHER_TYPE.RECEIPT,
              refType: ACCOUNTING_SOURCE_TYPE.ORDER,
              refId: In(exportOrderIds),
            },
            {
              type: MONEY_VOUCHER_TYPE.RECEIPT,
              orderId: In(exportOrderIds),
            },
          ]
        : []),
    ];
    const moneyVouchers = voucherWhere.length
      ? await this.moneyVoucherRepository.find({
          where: voucherWhere,
          relations: ['fund', 'supplier', 'customer', 'order'],
        })
      : [];
    const paymentVoucherByImportId = new Map(
      moneyVouchers
        .filter((voucher) => voucher.type === MONEY_VOUCHER_TYPE.PAYMENT)
        .map((voucher) => [voucher.refId, voucher]),
    );
    const receiptVoucherByExportId = new Map(
      moneyVouchers
        .filter((voucher) => voucher.type === MONEY_VOUCHER_TYPE.RECEIPT)
        .filter((voucher) => exportReceiptIds.includes(voucher.refId))
        .map((voucher) => [voucher.refId, voucher]),
    );
    const receiptVoucherByOrderId = new Map(
      moneyVouchers
        .filter((voucher) => voucher.type === MONEY_VOUCHER_TYPE.RECEIPT)
        .filter(
          (voucher) =>
            voucher.orderId || voucher.refType === ACCOUNTING_SOURCE_TYPE.ORDER,
        )
        .map((voucher) => [voucher.orderId || voucher.refId, voucher]),
    );
    const paymentVoucherIds = moneyVouchers
      .filter((voucher) => voucher.type === MONEY_VOUCHER_TYPE.PAYMENT)
      .map((voucher) => voucher.id);
    const paidReceipts = paymentVoucherIds.length
      ? await this.fundReceiptPaidRepository.find({
          where: { moneyVoucherId: In(paymentVoucherIds) },
          relations: ['fund', 'details'],
        })
      : [];
    const paidReceiptByMoneyVoucherId = new Map(
      paidReceipts.map((receipt) => [receipt.moneyVoucherId, receipt]),
    );
    const receiptVoucherIds = moneyVouchers
      .filter((voucher) => voucher.type === MONEY_VOUCHER_TYPE.RECEIPT)
      .map((voucher) => voucher.id);
    const receivedReceipts = receiptVoucherIds.length
      ? await this.fundReceiptReceivedRepository.find({
          where: { moneyVoucherId: In(receiptVoucherIds) },
          relations: ['fund', 'details'],
        })
      : [];
    const receivedReceiptByMoneyVoucherId = new Map(
      receivedReceipts.map((receipt) => [receipt.moneyVoucherId, receipt]),
    );

    return details.map((detail) => {
      const importReceipt = detail.importReceipt;
      if (importReceipt) {
        const paymentVoucher = paymentVoucherByImportId.get(importReceipt.id);
        if (paymentVoucher) {
          (importReceipt as any).paymentVoucher = paymentVoucher;
          (importReceipt as any).moneyVoucher = paymentVoucher;
          const paidReceipt = paidReceiptByMoneyVoucherId.get(
            paymentVoucher.id,
          );
          if (paidReceipt) {
            (importReceipt as any).paidReceipt = paidReceipt;
            (importReceipt as any).paymentReceipt = paidReceipt;
          }
        }
      }

      const exportReceipt = detail.exportReceipt;
      if (exportReceipt) {
        const receiptVoucher =
          receiptVoucherByExportId.get(exportReceipt.id) ||
          (exportReceipt.referenceType === 'order'
            ? receiptVoucherByOrderId.get(exportReceipt.referenceId)
            : undefined);
        if (receiptVoucher) {
          (exportReceipt as any).receiptVoucher = receiptVoucher;
          (exportReceipt as any).moneyVoucher = receiptVoucher;
          const receivedReceipt = receivedReceiptByMoneyVoucherId.get(
            receiptVoucher.id,
          );
          if (receivedReceipt) {
            (exportReceipt as any).receivedReceipt = receivedReceipt;
            (exportReceipt as any).paymentReceipt = receivedReceipt;
          }
        }
      }

      return detail;
    });
  }

  async createVoucher(dto: CreateStockVoucherDto) {
    const type = dto.type.toUpperCase();

    const totalAmount = dto.items.reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.unitPrice || 0);
    }, 0);

    const branchId = dto.branchId || DEFAULT_BRANCH_ID;
    const sourceId = this.getSourceId(dto);
    const sourceType = this.getSourceType(dto);
    if (
      type === STOCK_VOUCHER_TYPE.IMPORT &&
      sourceType === STOCK_PARTY_TYPE.SUPPLIER
    ) {
      return this.createSupplierImportVoucher(dto, {
        branchId,
        sourceId: sourceId!,
        sourceType,
      });
    }

    let branchStock: Stock | null = null;
    let fromStock: Stock | null = null;
    let toStock: Stock | null = null;

    if (
      type === STOCK_VOUCHER_TYPE.IMPORT ||
      type === STOCK_VOUCHER_TYPE.EXPORT
    ) {
      branchStock = await this.stockService.getOrCreateBranchStock(branchId);
    } else if (type === STOCK_VOUCHER_TYPE.TRANSFER) {
      if (!dto.fromBranchId || !dto.toBranchId) {
        throw new BadRequestException(
          'Both fromBranchId and toBranchId are required for stock transfers',
        );
      }
      fromStock = await this.stockService.getOrCreateBranchStock(
        dto.fromBranchId,
      );
      toStock = await this.stockService.getOrCreateBranchStock(dto.toBranchId);
    }

    const reason = dto.reasonCode
      ? await this.resolveReceiptReason(dto.reasonCode)
      : null;
    const reasonCode = reason?.code || dto.reasonCode || undefined;
    const fundId = dto.fundId || undefined;
    const supplierId =
      sourceType === STOCK_PARTY_TYPE.SUPPLIER && sourceId
        ? sourceId
        : undefined;

    let headerReceipt:
      | StockReceiptImport
      | StockReceiptExport
      | StockReceiptTransfer;

    if (type === STOCK_VOUCHER_TYPE.IMPORT) {
      const code = `NK${Date.now()}`;
      headerReceipt = await this.stockReceiptImportRepository.save(
        this.stockReceiptImportRepository.create({
          code,
          branchId,
          fromId: sourceId || undefined,
          fromType: sourceType || undefined,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          reasonCode: reasonCode || undefined,
          totalAmount,
          status: STOCK_VOUCHER_STATUS.COMPLETED,
          note: dto.note,
        }),
      );
    } else if (type === STOCK_VOUCHER_TYPE.EXPORT) {
      const code = `XK${Date.now()}`;
      headerReceipt = await this.stockReceiptExportRepository.save(
        this.stockReceiptExportRepository.create({
          code,
          branchId,
          toId: sourceId || undefined,
          toType: sourceType || undefined,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          reasonCode: reasonCode || undefined,
          totalAmount,
          status: STOCK_VOUCHER_STATUS.COMPLETED,
          note: dto.note,
        }),
      );
    } else {
      const code = `CK${Date.now()}`;
      headerReceipt = await this.stockReceiptTransferRepository.save(
        this.stockReceiptTransferRepository.create({
          code,
          fromBranchId: dto.fromBranchId!,
          toBranchId: dto.toBranchId!,
          status: STOCK_VOUCHER_STATUS.COMPLETED,
          receivedAt: new Date(),
          totalAmount,
          note: dto.note,
        }),
      );
    }

    const savedDetails: StockReceiptDetail[] = [];

    for (const dtoItem of dto.items) {
      const quantity = Number(dtoItem.quantity);
      let fromId: string | null = null;
      let toId: string | null = null;
      let fromType: string = STOCK_PARTY_TYPE.STOCK;
      let toType: string = STOCK_PARTY_TYPE.STOCK;

      if (type === STOCK_VOUCHER_TYPE.IMPORT) {
        fromId = sourceId;
        fromType = sourceType || STOCK_PARTY_TYPE.SUPPLIER;
        if (sourceType === STOCK_PARTY_TYPE.BRANCH && sourceId) {
          await this.stockService.getOrCreateBranchStock(sourceId);
        }
        toId = branchId;
        toType = STOCK_PARTY_TYPE.BRANCH;
      } else if (type === STOCK_VOUCHER_TYPE.EXPORT) {
        fromId = branchId;
        fromType = STOCK_PARTY_TYPE.BRANCH;
        if (sourceType === STOCK_PARTY_TYPE.BRANCH && sourceId) {
          await this.stockService.getOrCreateBranchStock(sourceId);
          toId = sourceId;
          toType = STOCK_PARTY_TYPE.BRANCH;
        } else {
          toId = sourceId || dto.referenceId || null;
          toType = sourceType || STOCK_PARTY_TYPE.CUSTOMER;
        }
      } else if (type === STOCK_VOUCHER_TYPE.TRANSFER) {
        fromId = fromStock!.id;
        fromType = STOCK_PARTY_TYPE.STOCK;
        toId = toStock!.id;
        toType = STOCK_PARTY_TYPE.STOCK;
      }

      const detailData = {
        productId: dtoItem.productId,
        quantity,
        receiptType: type,
        fromId,
        toId,
        fromType,
        toType,
        importId:
          type === STOCK_VOUCHER_TYPE.IMPORT ? headerReceipt.id : undefined,
        exportId:
          type === STOCK_VOUCHER_TYPE.EXPORT ? headerReceipt.id : undefined,
        transferId:
          type === STOCK_VOUCHER_TYPE.TRANSFER ? headerReceipt.id : undefined,
      };

      const detail = await this.stockReceiptDetailRepository.save(
        this.stockReceiptDetailRepository.create(detailData),
      );
      savedDetails.push(detail);

      if (dtoItem.productId) {
        if (type === STOCK_VOUCHER_TYPE.IMPORT) {
          await this.updateStockItemQuantity(
            this.stockItemRepository,
            branchStock!.id,
            dtoItem.productId,
            quantity,
          );
        } else if (type === STOCK_VOUCHER_TYPE.EXPORT) {
          await this.updateStockItemQuantity(
            this.stockItemRepository,
            branchStock!.id,
            dtoItem.productId,
            -quantity,
          );
        } else if (type === STOCK_VOUCHER_TYPE.TRANSFER) {
          await this.updateStockItemQuantity(
            this.stockItemRepository,
            fromId!,
            dtoItem.productId,
            -quantity,
          );
          await this.updateStockItemQuantity(
            this.stockItemRepository,
            toId!,
            dtoItem.productId,
            quantity,
          );
        }
      }
    }

    if (fundId && totalAmount > 0 && type === STOCK_VOUCHER_TYPE.EXPORT) {
      await this.financeService.createMoneyVoucher({
        type: MONEY_VOUCHER_TYPE.RECEIPT,
        fundId,
        amount: totalAmount,
        orderId: dto.referenceType === 'order' ? dto.referenceId : undefined,
        purpose: ACCOUNTING_PURPOSE.STOCK_EXPORT,
        reasonCode,
        refType:
          dto.referenceType === 'order'
            ? ACCOUNTING_SOURCE_TYPE.ORDER
            : ACCOUNTING_SOURCE_TYPE.STOCK_VOUCHER,
        refId: dto.referenceId || headerReceipt.id,
        note: dto.note,
      });
    }

    const receiptRelation =
      type === STOCK_VOUCHER_TYPE.IMPORT
        ? 'importReceipt'
        : type === STOCK_VOUCHER_TYPE.EXPORT
          ? 'exportReceipt'
          : 'transferReceipt';

    const result = await this.stockReceiptDetailRepository.find({
      where: savedDetails.map((detail) => ({ id: detail.id })),
      relations: ['product', receiptRelation],
    });

    return this.attachMoneyVouchers(result);
  }
}
