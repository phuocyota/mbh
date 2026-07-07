import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OrderService } from '../orders/order.service';
import { WalletService } from '../wallet/wallet.service';
import {
  ORDER_STATUS,
  ORDER_PAYMENT_STATUS,
} from '../../common/constant/constant';

export interface MomoPaymentUrlResponse {
  payUrl: string;
  deeplink?: string;
  qrCode?: string;
  qrData: string;
}

@Injectable()
export class MomoService {
  private readonly logger = new Logger(MomoService.name);

  private readonly endpoint: string;
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly returnUrl: string;
  private readonly notifyUrl: string;

  constructor(
    private configService: ConfigService,
    private orderService: OrderService,
    private walletService: WalletService,
  ) {
    this.endpoint = this.configService.get<string>('MOMO_ENDPOINT') || '';
    this.partnerCode =
      this.configService.get<string>('MOMO_PARTNER_CODE') || '';
    this.accessKey = this.configService.get<string>('MOMO_ACCESS_KEY') || '';
    this.secretKey = this.configService.get<string>('MOMO_SECRET_KEY') || '';
    this.returnUrl = this.configService.get<string>('MOMO_RETURN_URL') || '';
    this.notifyUrl = this.configService.get<string>('MOMO_NOTIFY_URL') || '';
  }

  async createPayment(
    orderId: string,
    createdBy?: string,
  ): Promise<MomoPaymentUrlResponse> {
    this.assertReady();
    const order = await this.orderService.findOrderByIdOrThrow(orderId);

    if (order.paymentStatus !== ORDER_PAYMENT_STATUS.UNPAID) {
      throw new BadRequestException('Order payment must be in UNPAID status');
    }
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      throw new BadRequestException('Order status must be PENDING_PAYMENT');
    }

    const amount = this.normalizeAmount(order.totalAmount);
    const orderInfo = `Thanh toan don hang ${order.orderCode}`;
    const redirectUrl = this.returnUrl;
    const ipnUrl = this.notifyUrl;
    const requestType = 'captureWallet';
    const extraData = this.createExtraData(createdBy);
    const orderGroupId = '';
    const autoCapture = true;
    const lang = 'vi';

    const timestamp = Date.now().toString();
    const requestId = `REQ-${timestamp}-${Math.floor(Math.random() * 10000)}`;
    const momoOrderId = `${orderId}-${timestamp}`;

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = this.sign(rawSignature);

    const requestBody = {
      partnerCode: this.partnerCode,
      partnerName: 'Test',
      storeId: 'MomoTestStore',
      requestId,
      amount,
      orderId: momoOrderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang,
      requestType,
      autoCapture,
      extraData,
      orderGroupId,
      signature,
    };

    const responseData = await this.sendRequest(requestBody);

    if (responseData.resultCode === 0) {
      return this.toPaymentUrlResponse(responseData);
    }

    throw this.createMomoApiException(
      responseData,
      'Failed to create MoMo payment URL',
    );
  }

  async createTopupPayment(
    customerId: string,
    amount: number,
    createdBy?: string,
  ): Promise<MomoPaymentUrlResponse> {
    this.assertReady();
    amount = this.normalizeAmount(amount);

    const orderInfo = 'Nap tien vao vi';
    const redirectUrl = this.returnUrl;
    const ipnUrl = this.notifyUrl;
    const requestType = 'captureWallet';
    const extraData = this.createExtraData(createdBy);
    const orderGroupId = '';
    const autoCapture = true;
    const lang = 'vi';

    const timestamp = Date.now().toString();
    const requestId = `REQ-${timestamp}-${Math.floor(Math.random() * 10000)}`;
    const momoOrderId = `TOPUP-${customerId}-${timestamp}`;

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = this.sign(rawSignature);

    const requestBody = {
      partnerCode: this.partnerCode,
      partnerName: 'Test',
      storeId: 'MomoTestStore',
      requestId,
      amount,
      orderId: momoOrderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang,
      requestType,
      autoCapture,
      extraData,
      orderGroupId,
      signature,
    };

    const responseData = await this.sendRequest(requestBody);

    if (responseData.resultCode === 0) {
      return this.toPaymentUrlResponse(responseData);
    }

    throw this.createMomoApiException(
      responseData,
      'Failed to create MoMo topup URL',
    );
  }

  private async sendRequest(requestBody: any): Promise<any> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(requestBody),
      });

      return response.json();
    } catch (error) {
      this.logger.error(`Error calling MoMo API: ${error.message}`);
      throw new BadRequestException('Failed to communicate with MoMo');
    }
  }

  private createMomoApiException(responseData: any, fallbackMessage: string) {
    const resultCode = responseData?.resultCode;
    const message = responseData?.message;
    const errorMessage =
      resultCode !== undefined || message
        ? `MoMo API Error ${resultCode ?? 'unknown'}: ${message ?? fallbackMessage}`
        : fallbackMessage;

    this.logger.error(errorMessage);
    return new BadRequestException(errorMessage);
  }

  private toPaymentUrlResponse(responseData: any): MomoPaymentUrlResponse {
    return {
      payUrl: responseData.payUrl,
      deeplink: responseData.deeplink,
      qrCode: responseData.qrCode,
      qrData:
        responseData.qrCode || responseData.deeplink || responseData.payUrl,
    };
  }

  async processIpn(ipnData: any): Promise<void> {
    this.assertReady();
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = ipnData;

    if (partnerCode !== this.partnerCode) {
      throw new BadRequestException('Invalid partnerCode');
    }

    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData ?? ''}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    const expectedSignature = this.sign(rawSignature);

    if (!this.isValidSignature(signature, expectedSignature)) {
      this.logger.error('Invalid MoMo IPN signature');
      throw new BadRequestException('Invalid signature');
    }

    const paidAmount = this.normalizeAmount(amount);
    const createdBy = this.extractCreatedBy(extraData);

    if (Number(resultCode) === 0) {
      if (String(orderId).startsWith('TOPUP-')) {
        const customerId = this.extractTopupCustomerId(orderId);
        const existingTopup = await this.walletService.findMomoTopupByTransId(
          String(transId),
        );
        if (existingTopup) {
          return;
        }

        await this.walletService.topup(
          customerId,
          paidAmount,
          createdBy,
          `Nap tien qua MoMo (GD: ${transId})`,
        );
      } else {
        const originalOrderId = this.extractOrderId(orderId);
        await this.orderService.receiveMomoPayment(originalOrderId, {
          amount: paidAmount,
          transId: String(transId),
          createdBy,
        });
      }
    } else {
      this.logger.warn(`MoMo Payment failed for order ${orderId}: ${message}`);
    }
  }

  private assertReady(): void {
    const missingConfigs = [
      ['MOMO_ENDPOINT', this.endpoint],
      ['MOMO_PARTNER_CODE', this.partnerCode],
      ['MOMO_ACCESS_KEY', this.accessKey],
      ['MOMO_SECRET_KEY', this.secretKey],
      ['MOMO_RETURN_URL', this.returnUrl],
      ['MOMO_NOTIFY_URL', this.notifyUrl],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingConfigs.length > 0) {
      throw new InternalServerErrorException(
        `Missing MoMo config: ${missingConfigs.join(', ')}`,
      );
    }
  }

  private normalizeAmount(value: number): number {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('MoMo amount must be a positive integer');
    }

    return amount;
  }

  private sign(rawSignature: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');
  }

  private createExtraData(createdBy?: string): string {
    if (!createdBy) {
      return '';
    }

    return Buffer.from(JSON.stringify({ createdBy })).toString('base64');
  }

  private extractCreatedBy(extraData?: string): string | undefined {
    if (!extraData) {
      return undefined;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(String(extraData), 'base64').toString('utf8'),
      );
      const createdBy = decoded?.createdBy;

      return this.isUuid(createdBy) ? createdBy : undefined;
    } catch {
      return undefined;
    }
  }

  private isUuid(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    );
  }

  private isValidSignature(
    signature: string,
    expectedSignature: string,
  ): boolean {
    const signatureBuffer = Buffer.from(String(signature), 'hex');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

    return (
      signatureBuffer.length === expectedSignatureBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    );
  }

  private extractOrderId(momoOrderId: string): string {
    const separatorIndex = momoOrderId.lastIndexOf('-');
    if (separatorIndex <= 0) {
      throw new BadRequestException('Invalid MoMo orderId');
    }

    return momoOrderId.slice(0, separatorIndex);
  }

  private extractTopupCustomerId(momoOrderId: string): string {
    if (!momoOrderId.startsWith('TOPUP-')) {
      throw new BadRequestException('Invalid MoMo topup orderId');
    }

    const withoutPrefix = momoOrderId.slice('TOPUP-'.length);
    const separatorIndex = withoutPrefix.lastIndexOf('-');
    if (separatorIndex <= 0) {
      throw new BadRequestException('Invalid MoMo topup orderId');
    }

    return withoutPrefix.slice(0, separatorIndex);
  }
}
