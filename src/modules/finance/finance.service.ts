import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  Debt,
  Fund,
  FundTransaction,
  MoneyVoucher,
  Supplier,
  FundReceiptReceived,
  FundReceiptPaid,
  FundReceiptTransfer,
  FundDetail,
} from '../../entities';
import { CreateFundDto } from './dto/create-fund.dto';
import { CreateMoneyVoucherDto } from './dto/create-money-voucher.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import {
  ACCOUNTING_SOURCE_TYPE,
  ACCOUNTING_PURPOSE,
  AccountingRuleError,
  createMoneyVoucherCode,
  DEBT_TRANSACTION_TYPE,
  defaultAccountingSourceType,
  getFundBalanceAfterVoucher,
  MONEY_VOUCHER_TYPE,
  normalizeMoneyVoucherType,
  resolveMoneyVoucherPosting,
} from '../../../packages/accounting/src/index.js';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Fund)
    private fundRepository: Repository<Fund>,
    @InjectRepository(FundTransaction)
    private fundTransactionRepository: Repository<FundTransaction>,
    @InjectRepository(MoneyVoucher)
    private moneyVoucherRepository: Repository<MoneyVoucher>,
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(FundReceiptReceived)
    private fundReceiptReceivedRepository: Repository<FundReceiptReceived>,
    @InjectRepository(FundReceiptPaid)
    private fundReceiptPaidRepository: Repository<FundReceiptPaid>,
    @InjectRepository(FundReceiptTransfer)
    private fundReceiptTransferRepository: Repository<FundReceiptTransfer>,
    @InjectRepository(FundDetail)
    private fundDetailRepository: Repository<FundDetail>,
    private dataSource: DataSource,
  ) {}

  async findFunds(page?: number | string, size?: number | string) {
    const pagination = normalizePagination(page, size);
    const [data, total] = await this.fundRepository.findAndCount({
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  createFund(dto: CreateFundDto) {
    return this.fundRepository.save(this.fundRepository.create(dto));
  }

  async findMoneyVouchers(page?: number | string, size?: number | string) {
    const pagination = normalizePagination(page, size);
    const [data, total] = await this.moneyVoucherRepository.findAndCount({
      relations: ['fund', 'order', 'supplier'],
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  createReceipt(dto: Omit<CreateMoneyVoucherDto, 'type'>) {
    return this.createMoneyVoucher({
      ...dto,
      type: MONEY_VOUCHER_TYPE.RECEIPT,
    });
  }

  createPayment(dto: Omit<CreateMoneyVoucherDto, 'type'>) {
    return this.createMoneyVoucher({
      ...dto,
      type: MONEY_VOUCHER_TYPE.PAYMENT,
    });
  }

  async createMoneyVoucher(
    dto: CreateMoneyVoucherDto,
    manager?: EntityManager,
  ) {
    const executor = async (trx: EntityManager) => {
      const type = this.mapAccountingRule(() =>
        normalizeMoneyVoucherType(dto.type),
      );

      const fundRepo = trx.getRepository(Fund);
      const voucherRepo = trx.getRepository(MoneyVoucher);
      const fundTransactionRepo = trx.getRepository(FundTransaction);
      const supplierRepo = trx.getRepository(Supplier);
      const debtRepo = trx.getRepository(Debt);

      const fund = await fundRepo.findOne({ where: { id: dto.fundId } });
      if (!fund) {
        throw new NotFoundException('Fund not found');
      }

      const accountingEntry = this.mapAccountingRule(() =>
        resolveMoneyVoucherPosting({
          type,
          fundAccountCode: fund.accountCode,
          purpose: dto.purpose,
          debitAccountCode: dto.debitAccountCode,
          creditAccountCode: dto.creditAccountCode,
        }),
      );
      const amount = Number(dto.amount);
      const currentBalance = Number(fund.balance || 0);
      const nextBalance = this.mapAccountingRule(() =>
        getFundBalanceAfterVoucher({ type, currentBalance, amount }),
      );

      const voucher = await voucherRepo.save(
        voucherRepo.create({
          ...dto,
          ...accountingEntry,
          type,
          code: createMoneyVoucherCode(type),
        }),
      );

      fund.balance = nextBalance;
      if (type === MONEY_VOUCHER_TYPE.RECEIPT) {
        fund.debit = Number(fund.debit || 0) + amount;
      } else if (type === MONEY_VOUCHER_TYPE.PAYMENT) {
        fund.credit = Number(fund.credit || 0) + amount;
      }
      await fundRepo.save(fund);

      await fundTransactionRepo.save(
        fundTransactionRepo.create({
          fundId: fund.id,
          type,
          amount,
          balanceAfter: nextBalance,
          debitAccountCode: accountingEntry.debitAccountCode,
          creditAccountCode: accountingEntry.creditAccountCode,
          refType: defaultAccountingSourceType(dto.refType),
          refId: voucher.id,
          orderId: dto.orderId,
          note: dto.note,
        }),
      );

      const receivedRepo = trx.getRepository(FundReceiptReceived);
      const paidRepo = trx.getRepository(FundReceiptPaid);
      const detailRepo = trx.getRepository(FundDetail);

      if (type === MONEY_VOUCHER_TYPE.RECEIPT) {
        const receivedReceipt = await receivedRepo.save(
          receivedRepo.create({
            code: `PT${Date.now()}`,
            branchId: fund.branchId,
            amount,
            fundId: fund.id,
            orderId: dto.orderId,
            note: dto.note || dto.purpose,
            status: 'COMPLETED',
          }),
        );

        await detailRepo.save(
          detailRepo.create({
            amount,
            type: 'RECEIVED',
            category: dto.purpose || 'OTHER',
            fundId: fund.id,
            receivedId: receivedReceipt.id,
            note: dto.note || dto.purpose,
          }),
        );
      } else if (type === MONEY_VOUCHER_TYPE.PAYMENT) {
        const paidReceipt = await paidRepo.save(
          paidRepo.create({
            code: `PC${Date.now()}`,
            branchId: fund.branchId,
            amount,
            fundId: fund.id,
            orderId: dto.orderId,
            note: dto.note || dto.purpose,
            status: 'COMPLETED',
          }),
        );

        await detailRepo.save(
          detailRepo.create({
            amount,
            type: 'PAID',
            category: dto.purpose || 'OTHER',
            fundId: fund.id,
            paidId: paidReceipt.id,
            note: dto.note || dto.purpose,
          }),
        );
      }

      if (
        type === MONEY_VOUCHER_TYPE.PAYMENT &&
        dto.purpose === ACCOUNTING_PURPOSE.SUPPLIER_DEBT_OFFSET
      ) {
        if (!dto.supplierId) {
          throw new BadRequestException(
            'supplierId is required for supplier debt offset',
          );
        }

        const supplier = await supplierRepo.findOne({
          where: { id: dto.supplierId },
        });
        if (!supplier) {
          throw new NotFoundException('Supplier not found');
        }

        const nextDebt = Number(supplier.debt || 0) - amount;
        supplier.debt = nextDebt;
        await supplierRepo.save(supplier);

        await debtRepo.save(
          debtRepo.create({
            supplierId: supplier.id,
            type: DEBT_TRANSACTION_TYPE.PAYMENT_OFFSET,
            amount,
            balanceAfter: nextDebt,
            refType: ACCOUNTING_SOURCE_TYPE.MONEY_VOUCHER,
            refId: voucher.id,
            note: dto.note,
          }),
        );
      }

      return voucherRepo.findOne({
        where: { id: voucher.id },
        relations: ['fund', 'order', 'supplier'],
      });
    };

    if (manager) {
      return executor(manager);
    }

    return this.dataSource.transaction(executor);
  }

  async createTransfer(
    dto: CreateTransferDto,
    manager?: EntityManager,
  ) {
    const executor = async (trx: EntityManager) => {
      const fundRepo = trx.getRepository(Fund);
      const transferRepo = trx.getRepository(FundReceiptTransfer);
      const detailRepo = trx.getRepository(FundDetail);

      const fromFund = await fundRepo.findOne({ where: { id: dto.fromFundId } });
      if (!fromFund) {
        throw new NotFoundException('Source fund not found');
      }

      const toFund = await fundRepo.findOne({ where: { id: dto.toFundId } });
      if (!toFund) {
        throw new NotFoundException('Destination fund not found');
      }

      if (fromFund.id === toFund.id) {
        throw new BadRequestException('Source and destination funds cannot be the same');
      }

      const amount = Number(dto.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException('Transfer amount must be greater than 0');
      }

      const fromBalance = Number(fromFund.balance || 0);
      if (fromBalance < amount) {
        throw new BadRequestException('Fund balance is not enough');
      }

      // Update fromFund balance (decrease balance, increase credit)
      fromFund.balance = fromBalance - amount;
      fromFund.credit = Number(fromFund.credit || 0) + amount;
      await fundRepo.save(fromFund);

      // Update toFund balance (increase balance, increase debit)
      toFund.balance = Number(toFund.balance || 0) + amount;
      toFund.debit = Number(toFund.debit || 0) + amount;
      await fundRepo.save(toFund);

      const code = `CQ${Date.now()}`;

      const transferReceipt = await transferRepo.save(
        transferRepo.create({
          code,
          amount,
          fromFundId: fromFund.id,
          toFundId: toFund.id,
          note: dto.note,
          status: 'COMPLETED',
        }),
      );

      // Create two details (one PAID at fromFund, one RECEIVED at toFund)
      await detailRepo.save(
        detailRepo.create({
          amount,
          type: 'PAID',
          category: 'TRANSFER',
          fundId: fromFund.id,
          transferId: transferReceipt.id,
          note: dto.note || `Chuyển quỹ sang ${toFund.name}`,
        }),
      );

      await detailRepo.save(
        detailRepo.create({
          amount,
          type: 'RECEIVED',
          category: 'TRANSFER',
          fundId: toFund.id,
          transferId: transferReceipt.id,
          note: dto.note || `Nhận chuyển quỹ từ ${fromFund.name}`,
        }),
      );

      return transferRepo.findOne({
        where: { id: transferReceipt.id },
        relations: ['fromFund', 'toFund', 'details'],
      });
    };

    if (manager) {
      return executor(manager);
    }

    return this.dataSource.transaction(executor);
  }

  async findReceiptsReceived(page?: number | string, size?: number | string) {
    const pagination = normalizePagination(page, size);
    const [idRows, total] = await Promise.all([
      this.fundReceiptReceivedRepository
        .createQueryBuilder('receipt')
        .select('receipt.id', 'id')
        .orderBy('receipt.createdAt', 'DESC')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      this.fundReceiptReceivedRepository.count(),
    ]);

    const ids = idRows.map((row) => row.id);
    if (!ids.length) {
      return toPaginationResponse([], total, pagination.page, pagination.size);
    }

    const receipts = await this.fundReceiptReceivedRepository.find({
      where: { id: In(ids) },
      relations: ['fund', 'order', 'details'],
      order: { createdAt: 'DESC' },
    });
    const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
    const data = ids
      .map((id) => receiptById.get(id))
      .filter((receipt): receipt is FundReceiptReceived => !!receipt);

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async findReceiptsPaid(page?: number | string, size?: number | string) {
    const pagination = normalizePagination(page, size);
    const [idRows, total] = await Promise.all([
      this.fundReceiptPaidRepository
        .createQueryBuilder('receipt')
        .select('receipt.id', 'id')
        .orderBy('receipt.createdAt', 'DESC')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      this.fundReceiptPaidRepository.count(),
    ]);

    const ids = idRows.map((row) => row.id);
    if (!ids.length) {
      return toPaginationResponse([], total, pagination.page, pagination.size);
    }

    const receipts = await this.fundReceiptPaidRepository.find({
      where: { id: In(ids) },
      relations: ['fund', 'order', 'details'],
      order: { createdAt: 'DESC' },
    });
    const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
    const data = ids
      .map((id) => receiptById.get(id))
      .filter((receipt): receipt is FundReceiptPaid => !!receipt);

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async findTransfers(page?: number | string, size?: number | string) {
    const pagination = normalizePagination(page, size);
    const [idRows, total] = await Promise.all([
      this.fundReceiptTransferRepository
        .createQueryBuilder('transfer')
        .select('transfer.id', 'id')
        .orderBy('transfer.createdAt', 'DESC')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      this.fundReceiptTransferRepository.count(),
    ]);

    const ids = idRows.map((row) => row.id);
    if (!ids.length) {
      return toPaginationResponse([], total, pagination.page, pagination.size);
    }

    const transfers = await this.fundReceiptTransferRepository.find({
      where: { id: In(ids) },
      relations: ['fromFund', 'toFund', 'details'],
      order: { createdAt: 'DESC' },
    });
    const transferById = new Map(
      transfers.map((transfer) => [transfer.id, transfer]),
    );
    const data = ids
      .map((id) => transferById.get(id))
      .filter((transfer): transfer is FundReceiptTransfer => !!transfer);

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async findDetails(page?: number | string, size?: number | string) {
    const pagination = normalizePagination(page, size);
    const [data, total] = await this.fundDetailRepository.findAndCount({
      relations: ['fund'],
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  private mapAccountingRule<T>(callback: () => T): T {
    try {
      return callback();
    } catch (error) {
      if (error instanceof AccountingRuleError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
