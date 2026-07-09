import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
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
  StockFundReceiptReason,
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
} from '../../../packages/accounting/src/index.js';
import {
  normalizePagination,
  toPaginationResponse,
} from '../../common/dto/pagination.dto';

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
    @InjectRepository(StockFundReceiptReason)
    private stockFundReceiptReasonRepository: Repository<StockFundReceiptReason>,
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
    filters: FinanceSummaryRange = {},
  ) {
    const pagination = normalizePagination(page, size);
    const { from, to } = this.resolveSummaryRange(filters);
    const voucherType = this.normalizeSummaryVoucherType(filters.voucherType);
    const query = this.buildMoneyVoucherQuery(
      branchId,
      from,
      to,
      voucherType,
      filters.search,
    )
      .orderBy('voucher.createdAt', 'DESC')
      .skip(pagination.skip)
      .take(pagination.size);

    const [vouchers, total] = await query.getManyAndCount();

    return {
      ...toPaginationResponse(
        vouchers.map((voucher) => this.toMoneyVoucherListItem(voucher)),
        total,
        pagination.page,
        pagination.size,
      ),
      branchId: branchId || null,
      from: from?.toISOString() || null,
      to: to?.toISOString() || null,
      voucherType,
      search: filters.search?.trim() || null,
    };
  }

  private buildMoneyVoucherQuery(
    branchId?: string,
    from?: Date | null,
    to?: Date | null,
    voucherType?: FinanceSummaryVoucherType | null,
    search?: string,
  ) {
    const query = this.moneyVoucherRepository
      .createQueryBuilder('voucher')
      .leftJoinAndSelect('voucher.fund', 'fund')
      .leftJoinAndSelect('voucher.order', 'order')
      .leftJoinAndSelect('order.customer', 'orderCustomer')
      .leftJoinAndSelect('voucher.supplier', 'supplier')
      .leftJoinAndSelect('voucher.customer', 'customer');

    if (branchId) {
      query.andWhere('fund.branchId = :branchId', { branchId });
    }

    if (from) {
      query.andWhere('voucher.createdAt >= :from', { from });
    }

    if (to) {
      query.andWhere('voucher.createdAt <= :to', { to });
    }

    if (voucherType === 'RECEIVED') {
      query.andWhere('voucher.type = :voucherType', {
        voucherType: MONEY_VOUCHER_TYPE.RECEIPT,
      });
    } else if (voucherType === 'PAID') {
      query.andWhere('voucher.type = :voucherType', {
        voucherType: MONEY_VOUCHER_TYPE.PAYMENT,
      });
    } else if (voucherType === 'TRANSFER') {
      query.andWhere('1 = 0');
    }

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      query.andWhere(
        `(
          voucher.code ILIKE :search
          OR voucher.purpose ILIKE :search
          OR voucher.note ILIKE :search
          OR voucher.refType ILIKE :search
          OR order.orderCode ILIKE :search
          OR supplier.code ILIKE :search
          OR supplier.name ILIKE :search
          OR customer.customerCode ILIKE :search
          OR customer.fullName ILIKE :search
          OR orderCustomer.customerCode ILIKE :search
          OR orderCustomer.fullName ILIKE :search
        )`,
        { search: `%${trimmedSearch}%` },
      );
    }

    return query;
  }

  async summary(branchId?: string, range: FinanceSummaryRange = {}) {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    const { from, to } = this.resolveSummaryRange(range);
    const voucherType = this.normalizeSummaryVoucherType(range.voucherType);
    const baseQuery = this.buildMoneyVoucherQuery(
      branchId,
      from,
      to,
      voucherType,
      range.search,
    );

    const receiptType = MONEY_VOUCHER_TYPE.RECEIPT;
    const paymentType = MONEY_VOUCHER_TYPE.PAYMENT;

    const totalsQuery = baseQuery
      .clone()
      .select(
        `COALESCE(SUM(CASE WHEN voucher.type = :receiptType THEN voucher.amount ELSE 0 END), 0)`,
        'totalReceived',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN voucher.type = :paymentType THEN voucher.amount ELSE 0 END), 0)`,
        'totalPaid',
      )
      .addSelect(
        `COUNT(CASE WHEN voucher.type = :receiptType THEN 1 END)`,
        'receivedCount',
      )
      .addSelect(
        `COUNT(CASE WHEN voucher.type = :paymentType THEN 1 END)`,
        'paidCount',
      )
      .setParameters({ receiptType, paymentType });

    const breakdownQuery = baseQuery
      .clone()
      .select('voucher.type', 'type')
      .addSelect('voucher.purpose', 'category')
      .addSelect('COUNT(voucher.id)', 'count')
      .addSelect('COALESCE(SUM(voucher.amount), 0)', 'amount')
      .groupBy('voucher.type')
      .addGroupBy('voucher.purpose')
      .orderBy('voucher.type', 'ASC')
      .addOrderBy('voucher.purpose', 'ASC');

    const [totals, breakdownRows, funds] = await Promise.all([
      totalsQuery.getRawOne<{
        totalReceived: string | number;
        totalPaid: string | number;
        receivedCount: string | number;
        paidCount: string | number;
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
        transferIn: 0,
        transferOut: 0,
        netTransfer: 0,
        transferInCount: 0,
        transferOutCount: 0,
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

  /**
   *handle thu chi
   */
  async createMoneyVoucher(dto: CreateMoneyVoucherDto) {
    const type = this.mapAccountingRule(() =>
      normalizeMoneyVoucherType(dto.type),
    );

    const fund = await this.fundRepository.findOne({
      where: { id: dto.fundId },
    });
    if (!fund) {
      throw new NotFoundException('Fund not found');
    }

    const reason = dto.reasonCode
      ? await this.stockFundReceiptReasonRepository.findOne({
          where: { code: dto.reasonCode },
        })
      : null;
    if (dto.reasonCode && !reason) {
      throw new NotFoundException('Accounting reason not found');
    }

    const amount = Number(dto.amount);
    const currentBalance = Number(fund.balance || 0);
    const nextBalance = this.mapAccountingRule(() =>
      getFundBalanceAfterVoucher({ type, currentBalance, amount }),
    );

    const voucher = await this.moneyVoucherRepository.save(
      this.moneyVoucherRepository.create({
        fundId: dto.fundId,
        amount,
        orderId: dto.orderId,
        supplierId: dto.supplierId,
        customerId: dto.customerId,
        purpose: dto.purpose,
        refType: dto.refType,
        refId: dto.refId,
        note: dto.note,
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
    await this.fundRepository.save(fund);

    await this.fundTransactionRepository.save(
      this.fundTransactionRepository.create({
        fundId: fund.id,
        type,
        amount,
        balanceAfter: nextBalance,
        refType: defaultAccountingSourceType(dto.refType),
        refId: voucher.id,
        orderId: dto.orderId,
        note: dto.note,
      }),
    );

    const receiptNote = dto.note || reason?.reason || dto.purpose;
    const detailCategory = dto.reasonCode || dto.purpose || 'OTHER';

    if (type === MONEY_VOUCHER_TYPE.RECEIPT) {
      const receivedReceipt = await this.fundReceiptReceivedRepository.save(
        this.fundReceiptReceivedRepository.create({
          code: `PT${Date.now()}`,
          branchId: fund.branchId,
          amount,
          fundId: fund.id,
          orderId: dto.orderId,
          moneyVoucherId: voucher.id,
          note: receiptNote,
          status: 'COMPLETED',
        }),
      );

      await this.fundDetailRepository.save(
        this.fundDetailRepository.create({
          amount,
          type: 'RECEIVED',
          category: detailCategory,
          fundId: fund.id,
          receivedId: receivedReceipt.id,
          note: receiptNote,
        }),
      );
    } else if (type === MONEY_VOUCHER_TYPE.PAYMENT) {
      const paidReceipt = await this.fundReceiptPaidRepository.save(
        this.fundReceiptPaidRepository.create({
          code: `PC${Date.now()}`,
          branchId: fund.branchId,
          amount,
          fundId: fund.id,
          orderId: dto.orderId,
          moneyVoucherId: voucher.id,
          note: receiptNote,
          status: 'COMPLETED',
        }),
      );

      await this.fundDetailRepository.save(
        this.fundDetailRepository.create({
          amount,
          type: 'PAID',
          category: detailCategory,
          fundId: fund.id,
          paidId: paidReceipt.id,
          note: receiptNote,
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

      const supplier = await this.supplierRepository.findOne({
        where: { id: dto.supplierId },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      const nextDebt = Number(supplier.debt || 0) - amount;
      supplier.debt = nextDebt;
      await this.supplierRepository.save(supplier);

      await this.debtRepository.save(
        this.debtRepository.create({
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

    return this.moneyVoucherRepository.findOne({
      where: { id: voucher.id },
      relations: ['fund', 'order', 'order.customer', 'supplier', 'customer'],
    });
  }

  async createTransfer(dto: CreateTransferDto) {
    const fromFund = await this.fundRepository.findOne({
      where: { id: dto.fromFundId },
    });
    if (!fromFund) {
      throw new NotFoundException('Source fund not found');
    }

    const toFund = await this.fundRepository.findOne({
      where: { id: dto.toFundId },
    });
    if (!toFund) {
      throw new NotFoundException('Destination fund not found');
    }

    if (fromFund.id === toFund.id) {
      throw new BadRequestException(
        'Source and destination funds cannot be the same',
      );
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
    await this.fundRepository.save(fromFund);

    // Update toFund balance (increase balance, increase debit)
    toFund.balance = Number(toFund.balance || 0) + amount;
    toFund.debit = Number(toFund.debit || 0) + amount;
    await this.fundRepository.save(toFund);

    const code = `CQ${Date.now()}`;

    const transferReceipt = await this.fundReceiptTransferRepository.save(
      this.fundReceiptTransferRepository.create({
        code,
        amount,
        fromFundId: fromFund.id,
        toFundId: toFund.id,
        note: dto.note,
        status: 'COMPLETED',
      }),
    );

    // Create two details (one PAID at fromFund, one RECEIVED at toFund)
    await this.fundDetailRepository.save(
      this.fundDetailRepository.create({
        amount,
        type: 'PAID',
        category: 'TRANSFER',
        fundId: fromFund.id,
        transferId: transferReceipt.id,
        note: dto.note || `Chuyển quỹ sang ${toFund.name}`,
      }),
    );

    await this.fundDetailRepository.save(
      this.fundDetailRepository.create({
        amount,
        type: 'RECEIVED',
        category: 'TRANSFER',
        fundId: toFund.id,
        transferId: transferReceipt.id,
        note: dto.note || `Nhận chuyển quỹ từ ${fromFund.name}`,
      }),
    );

    return this.fundReceiptTransferRepository.findOne({
      where: { id: transferReceipt.id },
      relations: ['fromFund', 'toFund', 'details'],
    });
  }

  private toMoneyVoucherListItem(voucher: MoneyVoucher) {
    const order = voucher.order as any;
    const supplier = voucher.supplier as any;
    const directCustomer = voucher.customer as any;
    const orderCustomer = order?.customer;
    const customer = directCustomer || orderCustomer;
    const object = supplier
      ? {
          type: 'SUPPLIER',
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
        }
      : customer
        ? {
            type: 'CUSTOMER',
            id: customer.id,
            code: customer.customerCode,
            name: customer.fullName,
          }
        : null;

    return {
      id: voucher.id,
      code: voucher.code,
      voucherNumber: voucher.code,
      createdAt: voucher.createdAt,
      time: voucher.createdAt,
      reference: this.resolveVoucherReference(voucher),
      object,
      amount: Number(voucher.amount || 0),
      paymentForm: this.resolvePaymentForm(voucher.fund),
      fund: voucher.fund
        ? {
            id: voucher.fund.id,
            code: voucher.fund.code,
            name: voucher.fund.name,
            accountCode: voucher.fund.accountCode,
          }
        : null,
      type: voucher.type,
      voucherType:
        voucher.type === MONEY_VOUCHER_TYPE.RECEIPT ? 'RECEIVED' : 'PAID',
      purpose: voucher.purpose,
      refType: voucher.refType,
      refId: voucher.refId,
      orderId: voucher.orderId,
      supplierId: voucher.supplierId,
      customerId: voucher.customerId,
      note: voucher.note,
      description: voucher.note || voucher.purpose,
    };
  }

  private resolveVoucherReference(voucher: MoneyVoucher) {
    const order = voucher.order as any;
    if (order?.orderCode) {
      return {
        type: 'ORDER',
        id: order.id,
        code: order.orderCode,
      };
    }

    if (voucher.refType || voucher.refId) {
      return {
        type: voucher.refType,
        id: voucher.refId,
        code: voucher.refId,
      };
    }

    return null;
  }

  private resolvePaymentForm(fund?: Fund | null) {
    const accountCode = fund?.accountCode || '';
    if (accountCode.startsWith('111')) {
      return 'CASH';
    }

    if (accountCode.startsWith('112')) {
      return 'BANK';
    }

    return fund?.name || null;
  }

  async findReceiptsReceived(
    page?: number | string,
    size?: number | string,
    branchId?: string,
  ) {
    return this.findMoneyVouchers(page, size, branchId, {
      voucherType: 'RECEIVED',
    });
  }

  async findReceiptsPaid(
    page?: number | string,
    size?: number | string,
    branchId?: string,
  ) {
    return this.findMoneyVouchers(page, size, branchId, {
      voucherType: 'PAID',
    });
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

    return this.findMoneyVouchers(page, size, branchId, filters);
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
