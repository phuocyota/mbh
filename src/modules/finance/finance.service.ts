import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Debt, Fund, FundTransaction, MoneyVoucher, Supplier } from '../../entities';
import { CreateFundDto } from './dto/create-fund.dto';
import { CreateMoneyVoucherDto } from './dto/create-money-voucher.dto';

const PURPOSE_ACCOUNT_MAP: Record<string, { receiptAccountCode?: string; paymentAccountCode?: string }> = {
  ORDER_PAYMENT: { receiptAccountCode: '5111' },
  WAREHOUSE_EXPORT: { receiptAccountCode: '5111' },
  WAREHOUSE_IMPORT: { paymentAccountCode: '1561' },
  SUPPLIER_DEBT_OFFSET: { paymentAccountCode: '331' },
};

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
    return this.moneyVoucherRepository.find({ relations: ['fund', 'order', 'supplier'] });
  }

  createReceipt(dto: Omit<CreateMoneyVoucherDto, 'type'>) {
    return this.createMoneyVoucher({ ...dto, type: 'RECEIPT' });
  }

  createPayment(dto: Omit<CreateMoneyVoucherDto, 'type'>) {
    return this.createMoneyVoucher({ ...dto, type: 'PAYMENT' });
  }

  async createMoneyVoucher(dto: CreateMoneyVoucherDto, manager?: EntityManager) {
    const executor = async (trx: EntityManager) => {
      const type = dto.type.toUpperCase();
      if (!['RECEIPT', 'PAYMENT'].includes(type)) {
        throw new BadRequestException('Money voucher type must be RECEIPT or PAYMENT');
      }

      const fundRepo = trx.getRepository(Fund);
      const voucherRepo = trx.getRepository(MoneyVoucher);
      const fundTransactionRepo = trx.getRepository(FundTransaction);
      const supplierRepo = trx.getRepository(Supplier);
      const debtRepo = trx.getRepository(Debt);

      const fund = await fundRepo.findOne({ where: { id: dto.fundId } });
      if (!fund) {
        throw new NotFoundException('Fund not found');
      }

      const accountingEntry = this.resolveAccountingEntry(type, fund.accountCode, dto);
      const amount = Number(dto.amount);
      const currentBalance = Number(fund.balance || 0);
      const nextBalance = type === 'RECEIPT' ? currentBalance + amount : currentBalance - amount;
      if (nextBalance < 0) {
        throw new BadRequestException('Fund balance is not enough');
      }

      const voucher = await voucherRepo.save(
        voucherRepo.create({
          ...dto,
          ...accountingEntry,
          type,
          code: `${type === 'RECEIPT' ? 'PT' : 'PC'}${Date.now()}`,
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
          refType: dto.refType || 'MONEY_VOUCHER',
          refId: voucher.id,
          orderId: dto.orderId,
          note: dto.note,
        }),
      );

      if (type === 'PAYMENT' && dto.purpose === 'SUPPLIER_DEBT_OFFSET') {
        if (!dto.supplierId) {
          throw new BadRequestException('supplierId is required for supplier debt offset');
        }

        const supplier = await supplierRepo.findOne({ where: { id: dto.supplierId } });
        if (!supplier) {
          throw new NotFoundException('Supplier not found');
        }

        const nextDebt = Number(supplier.debt || 0) - amount;
        supplier.debt = nextDebt;
        await supplierRepo.save(supplier);

        await debtRepo.save(
          debtRepo.create({
            supplierId: supplier.id,
            type: 'PAYMENT_OFFSET',
            amount,
            balanceAfter: nextDebt,
            refType: 'MONEY_VOUCHER',
            refId: voucher.id,
            note: dto.note,
          }),
        );
      }

      return voucherRepo.findOne({ where: { id: voucher.id }, relations: ['fund', 'order', 'supplier'] });
    };

    if (manager) {
      return executor(manager);
    }

    return this.dataSource.transaction(executor);
  }

  private resolveAccountingEntry(type: string, fundAccountCode: string, dto: CreateMoneyVoucherDto) {
    if (dto.debitAccountCode && dto.creditAccountCode) {
      return {
        debitAccountCode: dto.debitAccountCode,
        creditAccountCode: dto.creditAccountCode,
      };
    }

    const purpose = dto.purpose || 'OTHER';
    const mapping = PURPOSE_ACCOUNT_MAP[purpose];
    if (!mapping) {
      throw new BadRequestException(`Accounting account mapping is required for purpose: ${purpose}`);
    }

    if (type === 'RECEIPT') {
      return {
        debitAccountCode: dto.debitAccountCode || fundAccountCode,
        creditAccountCode: dto.creditAccountCode || mapping.receiptAccountCode,
      };
    }

    return {
      debitAccountCode: dto.debitAccountCode || mapping.paymentAccountCode,
      creditAccountCode: dto.creditAccountCode || fundAccountCode,
    };
  }
}