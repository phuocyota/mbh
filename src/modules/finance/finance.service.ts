import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
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

type FinanceSummaryRange = {
  from?: string;
  to?: string;
  voucherType?: string;
  search?: string;
};

type FinanceSummaryVoucherType = 'RECEIVED' | 'PAID' | 'TRANSFER';

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

  async findFunds(
    page?: number | string,
    size?: number | string,
    branchId?: string,
  ) {
    const pagination = normalizePagination(page, size);
    const where: FindOptionsWhere<Fund> = {};

    if (branchId) {
      where.branchId = branchId;
    }

    const [data, total] = await this.fundRepository.findAndCount({
      where,
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  createFund(dto: CreateFundDto) {
    return this.fundRepository.save(this.fundRepository.create(dto));
  }

  async findMoneyVouchers(
    page?: number | string,
    size?: number | string,
    branchId?: string,
  ) {
    const pagination = normalizePagination(page, size);
    const query = this.moneyVoucherRepository
      .createQueryBuilder('voucher')
      .leftJoinAndSelect('voucher.fund', 'fund')
      .leftJoinAndSelect('voucher.order', 'order')
      .leftJoinAndSelect('voucher.supplier', 'supplier')
      .orderBy('voucher.createdAt', 'DESC')
      .skip(pagination.skip)
      .take(pagination.size);

    if (branchId) {
      query.andWhere('fund.branchId = :branchId', { branchId });
    }

    const [data, total] = await query.getManyAndCount();

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async summary(branchId?: string, range: FinanceSummaryRange = {}) {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    const { from, to } = this.resolveSummaryRange(range);
    const voucherType = this.normalizeSummaryVoucherType(range.voucherType);
    const baseQuery = this.fundDetailRepository
      .createQueryBuilder('detail')
      .innerJoin('detail.fund', 'fund')
      .where('fund.branchId = :branchId', { branchId });

    if (from) {
      baseQuery.andWhere('detail.createdAt >= :from', { from });
    }

    if (to) {
      baseQuery.andWhere('detail.createdAt <= :to', { to });
    }

    const transferCategory = 'TRANSFER';
    const receivedType = 'RECEIVED';
    const paidType = 'PAID';

    this.applySummaryVoucherTypeFilter(
      baseQuery,
      voucherType,
      transferCategory,
    );

    const totalsQuery = baseQuery
      .clone()
      .select(
        `COALESCE(SUM(CASE WHEN detail.type = :receivedType AND detail.category <> :transferCategory THEN detail.amount ELSE 0 END), 0)`,
        'totalReceived',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN detail.type = :paidType AND detail.category <> :transferCategory THEN detail.amount ELSE 0 END), 0)`,
        'totalPaid',
      )
      .addSelect(
        `COUNT(CASE WHEN detail.type = :receivedType AND detail.category <> :transferCategory THEN 1 END)`,
        'receivedCount',
      )
      .addSelect(
        `COUNT(CASE WHEN detail.type = :paidType AND detail.category <> :transferCategory THEN 1 END)`,
        'paidCount',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN detail.type = :receivedType AND detail.category = :transferCategory THEN detail.amount ELSE 0 END), 0)`,
        'transferIn',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN detail.type = :paidType AND detail.category = :transferCategory THEN detail.amount ELSE 0 END), 0)`,
        'transferOut',
      )
      .addSelect(
        `COUNT(CASE WHEN detail.type = :receivedType AND detail.category = :transferCategory THEN 1 END)`,
        'transferInCount',
      )
      .addSelect(
        `COUNT(CASE WHEN detail.type = :paidType AND detail.category = :transferCategory THEN 1 END)`,
        'transferOutCount',
      )
      .setParameters({ receivedType, paidType, transferCategory });

    const breakdownQuery = baseQuery
      .clone()
      .select('detail.type', 'type')
      .addSelect('detail.category', 'category')
      .addSelect('COUNT(detail.id)', 'count')
      .addSelect('COALESCE(SUM(detail.amount), 0)', 'amount')
      .groupBy('detail.type')
      .addGroupBy('detail.category')
      .orderBy('detail.type', 'ASC')
      .addOrderBy('detail.category', 'ASC');

    const [totals, breakdownRows, funds] = await Promise.all([
      totalsQuery.getRawOne<{
        totalReceived: string | number;
        totalPaid: string | number;
        receivedCount: string | number;
        paidCount: string | number;
        transferIn: string | number;
        transferOut: string | number;
        transferInCount: string | number;
        transferOutCount: string | number;
      }>(),
      breakdownQuery.getRawMany<{
        type: string;
        category: string;
        count: string | number;
        amount: string | number;
      }>(),
      this.fundRepository.find({
        where: { branchId },
        order: { name: 'ASC' },
      }),
    ]);

    const totalReceived = Number(totals?.totalReceived || 0);
    const totalPaid = Number(totals?.totalPaid || 0);
    const transferIn = Number(totals?.transferIn || 0);
    const transferOut = Number(totals?.transferOut || 0);

    return {
      branchId,
      from: from?.toISOString() || null,
      to: to?.toISOString() || null,
      voucherType,
      summary: {
        totalReceived,
        totalPaid,
        netAmount: totalReceived - totalPaid,
        receivedCount: Number(totals?.receivedCount || 0),
        paidCount: Number(totals?.paidCount || 0),
      },
      transfers: {
        transferIn,
        transferOut,
        netTransfer: transferIn - transferOut,
        transferInCount: Number(totals?.transferInCount || 0),
        transferOutCount: Number(totals?.transferOutCount || 0),
      },
      balances: this.buildFundBalanceSummary(funds),
      breakdown: breakdownRows.map((row) => ({
        type: row.type,
        category: row.category,
        count: Number(row.count || 0),
        amount: Number(row.amount || 0),
      })),
    };
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

  async findReceiptsReceived(
    page?: number | string,
    size?: number | string,
    branchId?: string,
  ) {
    const pagination = normalizePagination(page, size);
    const baseQuery = this.fundReceiptReceivedRepository
        .createQueryBuilder('receipt')
        .select('receipt.id', 'id');

    if (branchId) {
      baseQuery.where('receipt.branchId = :branchId', { branchId });
    }

    const [idRows, total] = await Promise.all([
      baseQuery
        .clone()
        .orderBy('receipt.createdAt', 'DESC')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      baseQuery.clone().getCount(),
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

  async findReceiptsPaid(
    page?: number | string,
    size?: number | string,
    branchId?: string,
  ) {
    const pagination = normalizePagination(page, size);
    const baseQuery = this.fundReceiptPaidRepository
        .createQueryBuilder('receipt')
        .select('receipt.id', 'id');

    if (branchId) {
      baseQuery.where('receipt.branchId = :branchId', { branchId });
    }

    const [idRows, total] = await Promise.all([
      baseQuery
        .clone()
        .orderBy('receipt.createdAt', 'DESC')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      baseQuery.clone().getCount(),
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

  async findTransfers(
    page?: number | string,
    size?: number | string,
    branchId?: string,
  ) {
    const pagination = normalizePagination(page, size);
    const baseQuery = this.fundReceiptTransferRepository
        .createQueryBuilder('transfer')
        .innerJoin('transfer.fromFund', 'fromFund')
        .innerJoin('transfer.toFund', 'toFund')
        .select('transfer.id', 'id');

    if (branchId) {
      baseQuery.where(
        '(fromFund.branchId = :branchId OR toFund.branchId = :branchId)',
        { branchId },
      );
    }

    const [idRows, total] = await Promise.all([
      baseQuery
        .clone()
        .orderBy('transfer.createdAt', 'DESC')
        .offset(pagination.skip)
        .limit(pagination.size)
        .getRawMany<{ id: string }>(),
      baseQuery.clone().getCount(),
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

  async findDetails(
    page?: number | string,
    size?: number | string,
    branchId?: string,
    filters: FinanceSummaryRange = {},
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    const pagination = normalizePagination(page, size);
    const { from, to } = this.resolveSummaryRange(filters);
    const voucherType = this.normalizeSummaryVoucherType(filters.voucherType);
    const query = this.fundDetailRepository
      .createQueryBuilder('detail')
      .leftJoinAndSelect('detail.fund', 'fund')
      .leftJoinAndSelect('detail.receivedReceipt', 'receivedReceipt')
      .leftJoinAndSelect('receivedReceipt.order', 'receivedOrder')
      .leftJoinAndSelect('detail.paidReceipt', 'paidReceipt')
      .leftJoinAndSelect('paidReceipt.order', 'paidOrder')
      .leftJoinAndSelect('detail.transferReceipt', 'transferReceipt')
      .orderBy('detail.createdAt', 'DESC')
      .skip(pagination.skip)
      .take(pagination.size);

    query.andWhere('fund.branchId = :branchId', { branchId });

    if (from) {
      query.andWhere('detail.createdAt >= :from', { from });
    }

    if (to) {
      query.andWhere('detail.createdAt <= :to', { to });
    }

    this.applySummaryVoucherTypeFilter(query, voucherType, 'TRANSFER');

    const search = filters.search?.trim();
    if (search) {
      query.andWhere(
        `(
          receivedReceipt.code ILIKE :search
          OR paidReceipt.code ILIKE :search
          OR transferReceipt.code ILIKE :search
          OR fund.name ILIKE :search
          OR detail.category ILIKE :search
          OR detail.note ILIKE :search
          OR receivedOrder.orderCode ILIKE :search
          OR paidOrder.orderCode ILIKE :search
        )`,
        { search: `%${search}%` },
      );
    }

    const [data, total] = await query.getManyAndCount();

    return {
      ...toPaginationResponse(data, total, pagination.page, pagination.size),
      branchId,
      from: from?.toISOString() || null,
      to: to?.toISOString() || null,
      voucherType,
      search: search || null,
    };
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

  private resolveSummaryRange(range: FinanceSummaryRange) {
    const from = range.from ? new Date(range.from) : null;
    if (from) {
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException('from must be a valid date');
      }

      from.setHours(0, 0, 0, 0);
    }

    const to = range.to ? new Date(range.to) : null;
    if (to) {
      if (Number.isNaN(to.getTime())) {
        throw new BadRequestException('to must be a valid date');
      }

      to.setHours(23, 59, 59, 999);
    }

    return { from, to };
  }

  private normalizeSummaryVoucherType(
    voucherType?: string,
  ): FinanceSummaryVoucherType | null {
    if (!voucherType) {
      return null;
    }

    const normalized = voucherType.trim().toUpperCase();
    const aliases: Record<string, FinanceSummaryVoucherType> = {
      PT: 'RECEIVED',
      RECEIVED: 'RECEIVED',
      PC: 'PAID',
      PAID: 'PAID',
      CQ: 'TRANSFER',
      TRANSFER: 'TRANSFER',
    };
    const resolved = aliases[normalized];

    if (!resolved) {
      throw new BadRequestException(
        'voucherType must be one of RECEIVED, PAID, TRANSFER, PT, PC, CQ',
      );
    }

    return resolved;
  }

  private buildFundBalanceSummary(funds: Fund[]) {
    const fundBalances = funds.map((fund) => ({
      id: fund.id,
      code: fund.code,
      name: fund.name,
      accountCode: fund.accountCode,
      balance: Number(fund.balance || 0),
    }));

    return {
      cash: fundBalances
        .filter((fund) => fund.accountCode?.startsWith('111'))
        .reduce((sum, fund) => sum + fund.balance, 0),
      deposit: fundBalances
        .filter((fund) => fund.accountCode?.startsWith('112'))
        .reduce((sum, fund) => sum + fund.balance, 0),
      total: fundBalances.reduce((sum, fund) => sum + fund.balance, 0),
      funds: fundBalances,
    };
  }

  private applySummaryVoucherTypeFilter(
    query: any,
    voucherType: FinanceSummaryVoucherType | null,
    transferCategory: string,
  ) {
    if (!voucherType) {
      return;
    }

    if (voucherType === 'TRANSFER') {
      query.andWhere('detail.category = :transferCategory', {
        transferCategory,
      });
      return;
    }

    query.andWhere(
      'detail.type = :voucherType AND detail.category <> :transferCategory',
      {
        voucherType,
        transferCategory,
      },
    );
  }
}
