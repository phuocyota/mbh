import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Debt,
  Fund,
  FundTransaction,
  MoneyVoucher,
  Supplier,
} from '../../entities';
import { CreateFundDto } from './dto/create-fund.dto';
import { CreateMoneyVoucherDto } from './dto/create-money-voucher.dto';
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
    private dataSource: DataSource,
  ) {}

  findFunds() {
    return this.fundRepository.find();
  }

  createFund(dto: CreateFundDto) {
    return this.fundRepository.save(this.fundRepository.create(dto));
  }

  findMoneyVouchers() {
    return this.moneyVoucherRepository.find({
      relations: ['fund', 'order', 'supplier'],
    });
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
