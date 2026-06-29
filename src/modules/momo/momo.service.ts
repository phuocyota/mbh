import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OrderService } from '../orders/order.service';
import { ORDER_STATUS, ORDER_PAYMENT_STATUS } from '../../common/constant/constant';

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
  ) {
    this.endpoint = this.configService.get<string>('MOMO_ENDPOINT');
    this.partnerCode = this.configService.get<string>('MOMO_PARTNER_CODE');
    this.accessKey = this.configService.get<string>('MOMO_ACCESS_KEY');
    this.secretKey = this.configService.get<string>('MOMO_SECRET_KEY');
    this.returnUrl = this.configService.get<string>('MOMO_RETURN_URL');
    this.notifyUrl = this.configService.get<string>('MOMO_NOTIFY_URL');
  }

  async createPayment(orderId: string): Promise<{ payUrl: string }> {
    const order = await this.orderService.findOrderByIdOrThrow(orderId);

    if (order.paymentStatus !== ORDER_PAYMENT_STATUS.UNPAID) {
      throw new BadRequestException('Order payment must be in UNPAID status');
    }
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      throw new BadRequestException('Order status must be PENDING_PAYMENT');
    }

    const amount = Number(order.totalAmount);
    const orderInfo = `Thanh toán đơn hàng ${order.orderCode}`;
    const redirectUrl = this.returnUrl;
    const ipnUrl = this.notifyUrl;
    const requestType = 'captureWallet';
    const extraData = '';
    const orderGroupId = '';
    const autoCapture = true;
    const lang = 'vi';

    // Transaction ID with timestamp to ensure uniqueness
    const requestId = orderId + '-' + Date.now();
    const momoOrderId = requestId;

    // Create signature
    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode: this.partnerCode,
      partnerName: 'Test',
      storeId: 'MomoTestStore',
      requestId: requestId,
      amount: amount,
      orderId: momoOrderId,
      orderInfo: orderInfo,
      redirectUrl: redirectUrl,
      ipnUrl: ipnUrl,
      lang: lang,
      requestType: requestType,
      autoCapture: autoCapture,
      extraData: extraData,
      orderGroupId: orderGroupId,
      signature: signature,
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (responseData.resultCode === 0) {
        return { payUrl: responseData.payUrl };
      } else {
        this.logger.error(`MoMo API Error: ${responseData.message}`);
        throw new BadRequestException('Failed to create MoMo payment URL');
      }
    } catch (error) {
      this.logger.error(`Error calling MoMo API: ${error.message}`);
      throw new BadRequestException('Failed to communicate with MoMo');
    }
  }

  async processIpn(ipnData: any): Promise<void> {
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

    // Verify signature
    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    if (signature !== expectedSignature) {
      this.logger.error('Invalid MoMo IPN signature');
      throw new BadRequestException('Invalid signature');
    }

    // Extract actual orderId (remove timestamp)
    const originalOrderId = orderId.split('-')[0];

    if (resultCode === 0) {
      // Payment successful
      await this.orderService.receiveMomoPayment(originalOrderId, {
        amount: Number(amount),
        transId: String(transId),
      });
    } else {
      // Payment failed or cancelled
      this.logger.warn(`MoMo Payment failed for order ${originalOrderId}: ${message}`);
      // Optionally handle failed payment (e.g. notify user)
    }
  }
}
