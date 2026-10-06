import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import {
  VIETINBANK_TOPUP_STATUS,
  VietinBankTopupRequest,
} from '../../entities/vietinbank-topup-request.entity';
import { VietinBankBankTransaction } from '../../entities/vietinbank-bank-transaction.entity';
import {
  COMMON_STATUS,
  WALLET_TRANSACTION_REF_TYPE,
  WALLET_TRANSACTION_TYPE,
} from '../../common/constant/constant';
import { FinanceService } from '../finance/finance.service';
import { SocketService } from '../socket/socket.service';
import {
  ACCOUNTING_PURPOSE,
  ACCOUNTING_SOURCE_TYPE,
  MONEY_VOUCHER_TYPE,
} from '../../../packages/accounting/src/index.js';
import {
  VietinBankNotifyDto,
  VietinBankNotifyResponse,
} from './dto/vietinbank.dto';
import { VietinBankGatewayService } from './vietinbank-gateway.service';
import {
  VietinBankConfigService,
  VietinBankRuntimeContext,
} from './vietinbank-config.service';

const BANK_DEBT_CLEARANCE_REASON_CODE = 'TNBHTS_BANK';
const TOPUP_PURPOSE_PREFIX = 'NAPTIEN';

@Injectable()
export class VietinBankService {
  private readonly logger = new Logger(VietinBankService.name);

  constructor(
    @InjectRepository(VietinBankTopupRequest)
    private readonly topupRepository: Repository<VietinBankTopupRequest>,
    @InjectRepository(VietinBankBankTransaction)
    private readonly bankTransactionRepository: Repository<VietinBankBankTransaction>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly configService: ConfigService,
    private readonly vietinBankConfigService: VietinBankConfigService,
    private readonly gateway: VietinBankGatewayService,
    private readonly financeService: FinanceService,
    private readonly socketService: SocketService,
  ) {}

  async createTopupQr(userId: string, branchId: string | null) {
    const runtime = await this.vietinBankConfigService.resolveForBranch(
      branchId || '',
    );
    await this.expirePendingRequests();

    const targetBalance = this.readPositiveInteger(
      'VIETINBANK_TARGET_BALANCE',
      50000,
    );
    const ttlMinutes = this.readPositiveInteger(
      'VIETINBANK_TOPUP_TTL_MINUTES',
      15,
    );

    const prepared = await this.topupRepository.manager.transaction(
      async (manager) => {
        const customerRepository = manager.getRepository(Customer);
        const walletRepository = manager.getRepository(Wallet);
        const topupRepository = manager.getRepository(VietinBankTopupRequest);

        const customer = await customerRepository.findOne({
          where: { userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!customer) {
          throw new NotFoundException('Customer not found for this user');
        }

        let wallet = await walletRepository.findOne({
          where: { customerId: customer.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!wallet) {
          wallet = await walletRepository.save(
            walletRepository.create({
              customerId: customer.id,
              balance: 0,
              status: COMMON_STATUS.ACTIVE,
              createdBy: userId,
            }),
          );
        }
        if (wallet.status !== COMMON_STATUS.ACTIVE) {
          throw new BadRequestException('Ví không ở trạng thái ACTIVE');
        }

        await topupRepository.update(
          {
            customerId: customer.id,
            status: VIETINBANK_TOPUP_STATUS.PENDING,
          },
          { status: VIETINBANK_TOPUP_STATUS.SUPERSEDED },
        );

        const currentBalance = Number(wallet.balance);
        if (!Number.isSafeInteger(currentBalance)) {
          throw new BadRequestException(
            'Số dư ví phải là số nguyên VND trước khi tạo QR',
          );
        }
        const amount = Math.max(targetBalance - currentBalance, 0);
        if (amount === 0) {
          return {
            code: 'NO_TOPUP_NEEDED' as const,
            currentBalance,
            targetBalance,
          };
        }

        const requestId = randomUUID();
        const paymentCode = `VTB${randomBytes(6).toString('hex').toUpperCase()}`;
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
        const request = await topupRepository.save(
          topupRepository.create({
            requestId,
            paymentCode,
            customerId: customer.id,
            branchId: runtime.config.branchId,
            vietinBankConfigId: runtime.config.id,
            vietinBankAccountId: runtime.account.id,
            balanceAtCreation: currentBalance,
            targetBalance,
            amount,
            qrContent: null,
            qrBase64: null,
            bankAccountNumber: runtime.account.accountNumber,
            bankAccountName: runtime.account.accountName || '',
            status: VIETINBANK_TOPUP_STATUS.PENDING,
            expiresAt,
            completedAt: null,
            failureReason: null,
            createdBy: userId,
          }),
        );

        return { code: 'QR_CREATED' as const, request };
      },
    );

    if (prepared.code === 'NO_TOPUP_NEEDED') {
      return {
        ...prepared,
        requestId: null,
        paymentCode: null,
        amount: 0,
        qrContent: null,
        qrBase64: null,
        bankAccountNumber: runtime.account.accountNumber,
        bankAccountName: runtime.account.accountName || '',
        status: null,
        expiresAt: null,
      };
    }

    const request = prepared.request;
    try {
      const qr = await this.gateway.generateQr(
        {
          requestId: request.requestId,
          amount: Number(request.amount),
          purpose: `${TOPUP_PURPOSE_PREFIX} ${request.paymentCode}`,
        },
        runtime,
      );
      await this.topupRepository.update(
        { id: request.id },
        { qrContent: qr.qrContent, qrBase64: qr.qrBase64 },
      );
      request.qrContent = qr.qrContent;
      request.qrBase64 = qr.qrBase64;
    } catch (error) {
      await this.topupRepository.update(
        {
          id: request.id,
          status: VIETINBANK_TOPUP_STATUS.PENDING,
        },
        {
          status: VIETINBANK_TOPUP_STATUS.FAILED,
          failureReason: this.safeFailureReason(error),
        },
      );
      throw error;
    }

    const persistedRequest = await this.topupRepository.findOne({
      where: { id: request.id },
    });
    return this.toTopupResponse(persistedRequest || request, 'QR_CREATED');
  }

  async getTopupStatus(userId: string, requestId: string) {
    const customer = await this.customerRepository.findOne({
      where: { userId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found for this user');
    }

    let request = await this.topupRepository.findOne({
      where: { requestId, customerId: customer.id },
    });
    if (!request) {
      throw new NotFoundException('VietinBank topup request not found');
    }

    if (
      request.status === VIETINBANK_TOPUP_STATUS.PENDING &&
      request.expiresAt.getTime() <= Date.now()
    ) {
      await this.topupRepository.update(
        { id: request.id, status: VIETINBANK_TOPUP_STATUS.PENDING },
        { status: VIETINBANK_TOPUP_STATUS.EXPIRED },
      );
      request = (await this.topupRepository.findOne({
        where: { id: request.id },
      }))!;
    }

    const bankTransaction = await this.bankTransactionRepository.findOne({
      where: { topupRequestId: request.id },
      order: { receivedAt: 'DESC' },
    });

    return {
      ...this.toTopupResponse(request, 'TOPUP_STATUS'),
      bankTransId: bankTransaction?.bankTransId || null,
      balanceAfter: bankTransaction
        ? Number(bankTransaction.balanceAfter)
        : null,
      completedAt: request.completedAt,
    };
  }

  async processNotify(
    body: VietinBankNotifyDto,
  ): Promise<VietinBankNotifyResponse> {
    const transId = this.asText(body?.transId);
    const providerId = this.asText(body?.providerId);
    const paymentCode = this.extractPaymentCode(body);
    const request = paymentCode
      ? await this.topupRepository.findOne({ where: { paymentCode } })
      : null;
    let runtime: VietinBankRuntimeContext | null = null;
    try {
      runtime = await this.vietinBankConfigService.resolveForCallback(
        request?.vietinBankConfigId || null,
        request?.vietinBankAccountId || null,
        providerId,
        this.asText(body?.recvAcctId),
      );
    } catch (error) {
      this.logger.warn(
        `Cannot resolve VietinBank callback config for transId=${transId}: ${this.safeFailureReason(error)}`,
      );
    }

    if (!this.hasRequiredNotifyFields(body)) {
      return this.notifyResponse(
        transId,
        providerId,
        '99',
        'Du lieu khong hop le',
        runtime,
      );
    }

    if (!runtime || !this.gateway.verifyNotifySignature(body, runtime)) {
      return this.notifyResponse(
        transId,
        providerId,
        '01',
        'Khong xac nhan duoc chu ky so',
        runtime,
      );
    }

    if (providerId !== runtime.config.providerId) {
      return this.notifyResponse(
        transId,
        providerId,
        '99',
        'Sai providerId',
        runtime,
      );
    }

    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return this.notifyResponse(
        transId,
        providerId,
        '03',
        'So tien khong hop le',
        runtime,
      );
    }
    if (body.currencyCode !== 'VND') {
      return this.notifyResponse(
        transId,
        providerId,
        '03',
        'Sai loai tien',
        runtime,
      );
    }
    if (body.recvAcctId !== runtime.account.accountNumber) {
      return this.notifyResponse(
        transId,
        providerId,
        '03',
        'Sai tai khoan nhan',
        runtime,
      );
    }

    if (!paymentCode) {
      return this.notifyResponse(
        transId,
        providerId,
        '02',
        'Khong tim thay ma nap tien',
        runtime,
      );
    }

    if (!request) {
      return this.notifyResponse(
        transId,
        providerId,
        '02',
        'Ma nap tien khong ton tai',
        runtime,
      );
    }
    if (Number(request.amount) !== amount) {
      return this.notifyResponse(
        transId,
        providerId,
        '03',
        'So tien khong khop',
        runtime,
      );
    }

    const existing = await this.bankTransactionRepository.findOne({
      where: { transId },
    });
    if (existing) {
      return this.isSameBankTransaction(existing, body, paymentCode)
        ? this.notifyResponse(transId, providerId, '00', 'Thanh cong', runtime)
        : this.notifyResponse(
            transId,
            providerId,
            '99',
            'Trung ma giao dich',
            runtime,
          );
    }

    try {
      const result = await this.topupRepository.manager.transaction(
        async (manager) => {
          const topupRepository = manager.getRepository(VietinBankTopupRequest);
          const bankTransactionRepository = manager.getRepository(
            VietinBankBankTransaction,
          );
          const customerRepository = manager.getRepository(Customer);
          const walletRepository = manager.getRepository(Wallet);
          const walletTransactionRepository =
            manager.getRepository(WalletTransaction);

          const lockedRequest = await topupRepository.findOne({
            where: { id: request.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!lockedRequest) {
            throw new Error('Topup request disappeared');
          }

          const duplicate = await bankTransactionRepository.findOne({
            where: { transId },
          });
          if (duplicate) {
            return { duplicate, recoveredDebtAmount: 0, transactionId: null };
          }

          const customer = await customerRepository.findOne({
            where: { id: lockedRequest.customerId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!customer) {
            throw new Error('Customer not found for topup');
          }

          let wallet = await walletRepository.findOne({
            where: { customerId: customer.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!wallet) {
            wallet = await walletRepository.save(
              walletRepository.create({
                customerId: customer.id,
                balance: 0,
                status: COMMON_STATUS.ACTIVE,
              }),
            );
          }
          if (wallet.status !== COMMON_STATUS.ACTIVE) {
            throw new Error('Wallet is not ACTIVE');
          }

          const balanceBefore = Number(wallet.balance);
          const balanceAfter = balanceBefore + amount;
          wallet.balance = balanceAfter;
          await walletRepository.save(wallet);

          const recoveredDebtAmount =
            Math.max(0, -balanceBefore) - Math.max(0, -balanceAfter);
          if (recoveredDebtAmount > 0) {
            await customerRepository.increment(
              { id: customer.id },
              'debtLimit',
              recoveredDebtAmount,
            );
          }

          const walletTransaction = await walletTransactionRepository.save(
            walletTransactionRepository.create({
              walletId: wallet.id,
              customerId: customer.id,
              type: WALLET_TRANSACTION_TYPE.TOPUP,
              amount,
              balanceBefore,
              balanceAfter,
              refType: WALLET_TRANSACTION_REF_TYPE.BANK_TOPUP,
              refId: lockedRequest.id,
              reasonCode: BANK_DEBT_CLEARANCE_REASON_CODE,
              note: `Nạp tiền qua VietinBank (GD: ${transId})`,
            }),
          );

          if (recoveredDebtAmount > 0) {
            const branchId = await this.resolveCustomerBranchId(
              manager,
              customer.id,
            );
            await this.financeService.createMoneyVoucher(
              {
                type: MONEY_VOUCHER_TYPE.RECEIPT,
                branchId,
                amount: recoveredDebtAmount,
                customerId: customer.id,
                purpose: ACCOUNTING_PURPOSE.CUSTOMER_DEBT_COLLECTION,
                reasonCode: BANK_DEBT_CLEARANCE_REASON_CODE,
                refType: ACCOUNTING_SOURCE_TYPE.WALLET_TRANSACTION,
                refId: walletTransaction.id,
                note: `Thu tiền gửi công nợ khách hàng ${customer.customerCode || customer.fullName}`,
              },
              manager,
            );
          }

          await bankTransactionRepository.save(
            bankTransactionRepository.create({
              transId,
              bankTransId: body.bankTransId,
              topupRequestId: lockedRequest.id,
              paymentCode,
              sendAccountId: body.sendAcctId || null,
              recvAccountId: body.recvAcctId,
              amount,
              currency: body.currencyCode,
              remark: body.remark || null,
              transTime: body.transTime,
              status: 'SUCCESS',
              balanceBefore,
              balanceAfter,
              rawRequest: this.sanitizeNotifyBody(body),
              receivedAt: new Date(),
            }),
          );

          lockedRequest.status = VIETINBANK_TOPUP_STATUS.SUCCESS;
          lockedRequest.completedAt = new Date();
          lockedRequest.failureReason = null;
          await topupRepository.save(lockedRequest);

          return {
            duplicate: null,
            recoveredDebtAmount,
            transactionId: walletTransaction.id,
          };
        },
      );

      if (result.duplicate) {
        return this.isSameBankTransaction(result.duplicate, body, paymentCode)
          ? this.notifyResponse(
              transId,
              providerId,
              '00',
              'Thanh cong',
              runtime,
            )
          : this.notifyResponse(
              transId,
              providerId,
              '99',
              'Trung ma giao dich',
              runtime,
            );
      }

      if (result.recoveredDebtAmount > 0 && result.transactionId) {
        this.socketService.emitCustomerDebtPaid({
          customerId: request.customerId,
          transactionId: result.transactionId,
        });
      }
      return this.notifyResponse(
        transId,
        providerId,
        '00',
        'Thanh cong',
        runtime,
      );
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        const raced = await this.bankTransactionRepository.findOne({
          where: { transId },
        });
        if (raced && this.isSameBankTransaction(raced, body, paymentCode)) {
          return this.notifyResponse(
            transId,
            providerId,
            '00',
            'Thanh cong',
            runtime,
          );
        }
      }
      this.logger.error(
        `VietinBank notify processing failed for transId=${transId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return this.notifyResponse(
        transId,
        providerId,
        '03',
        'Loi ghi nhan giao dich',
        runtime,
      );
    }
  }

  private async expirePendingRequests(): Promise<void> {
    await this.topupRepository.update(
      {
        status: VIETINBANK_TOPUP_STATUS.PENDING,
        expiresAt: LessThan(new Date()),
      },
      { status: VIETINBANK_TOPUP_STATUS.EXPIRED },
    );
  }

  private toTopupResponse(
    request: VietinBankTopupRequest,
    code: 'QR_CREATED' | 'TOPUP_STATUS',
  ) {
    return {
      code,
      requestId: request.requestId,
      paymentCode: request.paymentCode,
      currentBalance: Number(request.balanceAtCreation),
      targetBalance: Number(request.targetBalance),
      amount: Number(request.amount),
      qrContent: request.qrContent,
      qrBase64: request.qrBase64,
      bankAccountNumber: request.bankAccountNumber,
      bankAccountName: request.bankAccountName,
      status: request.status,
      expiresAt: request.expiresAt,
    };
  }

  private hasRequiredNotifyFields(body: VietinBankNotifyDto): boolean {
    return Boolean(
      body &&
      this.asText(body.transId) &&
      this.asText(body.transTime) &&
      this.asText(body.providerId) &&
      this.asText(body.amount) &&
      this.asText(body.bankTransId) &&
      this.asText(body.recvAcctId) &&
      this.asText(body.currencyCode) &&
      this.asText(body.signature),
    );
  }

  private extractPaymentCode(body: VietinBankNotifyDto): string | null {
    const custCode = this.asText(body.custCode).toUpperCase();
    if (/^VTB[A-F0-9]{12}$/.test(custCode)) {
      return custCode;
    }
    const match = this.asText(body.remark)
      .toUpperCase()
      .match(/(?:^|\s)(VTB[A-F0-9]{12})(?:\s|$)/);
    return match?.[1] || null;
  }

  private notifyResponse(
    transId: string,
    providerId: string,
    errorCode: string,
    errorDesc: string,
    runtime: VietinBankRuntimeContext | null,
  ): VietinBankNotifyResponse {
    return {
      transId,
      providerId,
      errorCode,
      errorDesc,
      signature: runtime
        ? this.gateway.signNotifyResponse(
            transId,
            errorCode,
            errorDesc,
            runtime,
          )
        : '',
    };
  }

  private isSameBankTransaction(
    existing: VietinBankBankTransaction,
    body: VietinBankNotifyDto,
    paymentCode: string,
  ): boolean {
    return (
      existing.bankTransId === body.bankTransId &&
      existing.paymentCode === paymentCode &&
      existing.recvAccountId === body.recvAcctId &&
      Number(existing.amount) === Number(body.amount) &&
      existing.currency === body.currencyCode
    );
  }

  private sanitizeNotifyBody(
    body: VietinBankNotifyDto,
  ): Record<string, unknown> {
    const { signature: _signature, ...safeBody } = body;
    return safeBody;
  }

  private async resolveCustomerBranchId(manager: any, customerId: string) {
    const [customerBranch] = await manager.query(
      `
        SELECT u.branch_id
        FROM customers c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.id = $1
        LIMIT 1
      `,
      [customerId],
    );
    if (!customerBranch?.branch_id) {
      throw new Error('Không xác định được chi nhánh khách hàng');
    }
    return customerBranch.branch_id as string;
  }

  private safeFailureReason(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return message.slice(0, 500);
  }

  private asText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }
}
