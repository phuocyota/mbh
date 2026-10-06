import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  constants as cryptoConstants,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from 'crypto';
import { VietinBankNotifyDto, VietinBankQrResult } from './dto/vietinbank.dto';
import { VietinBankRuntimeContext } from './vietinbank-config.service';

interface GenerateQrInput {
  requestId: string;
  amount: number;
  purpose: string;
}

@Injectable()
export class VietinBankGatewayService {
  constructor(private readonly configService: ConfigService) {}

  get isMock(): boolean {
    return (
      this.configService.get<string>('NODE_ENV') !== 'production' &&
      this.configService.get<string>('VIETINBANK_MOCK_ENABLED') === 'true'
    );
  }

  async generateQr(
    input: GenerateQrInput,
    context: VietinBankRuntimeContext,
  ): Promise<VietinBankQrResult> {
    this.assertContextReady(context, true);
    if (this.isMock) {
      const qrContent = [
        'VIETINBANK_MOCK',
        context.account.accountNumber,
        input.amount,
        input.purpose,
      ].join('|');
      return {
        qrContent,
        qrBase64: Buffer.from(qrContent, 'utf8').toString('base64'),
        providerRequestId: input.requestId,
        mock: true,
      };
    }

    const clientDt = new Date().toISOString();
    const signatureSource =
      input.requestId +
      context.config.providerId +
      context.config.merchantId +
      clientDt +
      context.account.accountNumber;
    const body = {
      requestId: input.requestId,
      merchantId: context.config.merchantId,
      providerId: context.config.providerId,
      channel: this.configService.get<string>('VIETINBANK_CHANNEL') || 'MOBILE',
      version: this.configService.get<string>('VIETINBANK_VERSION') || '1.0.1',
      clientIP:
        this.configService.get<string>('VIETINBANK_CLIENT_IP') || '127.0.0.1',
      language: 'vi',
      clientDt,
      signature: this.signText(signatureSource, context),
      data: {
        accountNumber: context.account.accountNumber,
        amount: String(input.amount),
        purposeOfTrans: input.purpose,
      },
    };

    let response: Response;
    try {
      response = await fetch(this.qrEndpoint(context.config.apiBaseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'x-ibm-client-id': context.config.clientId,
          'x-ibm-client-secret': context.clientSecret!,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(
          this.readPositiveInteger('VIETINBANK_TIMEOUT_MS', 10000),
        ),
      });
    } catch {
      throw new BadGatewayException('Không thể kết nối VietinBank');
    }
    const payload = await response.json().catch(() => null);
    const qrContent = payload?.data?.qrContent || payload?.qrContent;
    if (!response.ok || !qrContent) {
      throw new BadGatewayException('VietinBank không trả về mã QR hợp lệ');
    }
    return {
      qrContent: String(qrContent),
      qrBase64: payload?.data?.qrBase64 || payload?.qrBase64 || null,
      providerRequestId:
        payload?.data?.requestId || payload?.requestId || input.requestId,
      mock: false,
    };
  }

  verifyNotifySignature(
    body: VietinBankNotifyDto,
    context: VietinBankRuntimeContext,
  ): boolean {
    if (this.isMock) return body.signature === 'MOCK_SIGNATURE';
    const source = this.joinNonEmpty([
      body.transId,
      body.transTime,
      body.custCode,
      body.amount,
      body.bankTransId,
      body.remark,
    ]);
    try {
      return verify(
        this.getRsaAlgorithm(),
        Buffer.from(source, 'utf8'),
        {
          key: createPublicKey(this.normalizePem(context.config.bankPublicKey)),
          padding: this.getRsaPadding(),
        },
        Buffer.from(body.signature, 'base64'),
      );
    } catch {
      return false;
    }
  }

  signNotifyResponse(
    transId: string,
    errorCode: string,
    errorDesc: string,
    context: VietinBankRuntimeContext,
  ) {
    if (this.isMock) return 'MOCK_SIGNATURE';
    return this.signText(transId + errorCode + errorDesc, context);
  }

  private assertContextReady(
    context: VietinBankRuntimeContext,
    requireClientSecret: boolean,
  ) {
    const missing: string[] = [];
    if (!context.account.accountNumber) missing.push('accountNumber');
    if (!context.config.providerId) missing.push('providerId');
    if (!context.config.merchantId) missing.push('merchantId');
    if (!this.isMock) {
      if (!context.config.apiBaseUrl) missing.push('apiBaseUrl');
      if (!context.privateKey) missing.push('partnerPrivateKey');
      if (requireClientSecret && !context.clientSecret)
        missing.push('clientSecret');
    }
    if (missing.length) {
      throw new InternalServerErrorException(
        `Missing VietinBank config: ${missing.join(', ')}`,
      );
    }
  }

  private signText(source: string, context: VietinBankRuntimeContext): string {
    this.assertContextReady(context, false);
    return sign(this.getRsaAlgorithm(), Buffer.from(source, 'utf8'), {
      key: createPrivateKey(this.normalizePem(context.privateKey!)),
      padding: this.getRsaPadding(),
    }).toString('base64');
  }

  private qrEndpoint(apiBaseUrl: string): string {
    const path =
      this.configService.get<string>('VIETINBANK_QR_PATH') ||
      '/vtb-api-uat/development/qr/vietqr/gen';
    return `${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  private getRsaAlgorithm(): string {
    const value = this.configService.get<string>('VIETINBANK_RSA_ALGORITHM');
    if (!value) {
      throw new InternalServerErrorException(
        'Missing VietinBank config: VIETINBANK_RSA_ALGORITHM',
      );
    }
    return value;
  }

  private getRsaPadding(): number {
    const value = this.configService.get<string>('VIETINBANK_RSA_PADDING');
    if (value === 'PKCS1') return cryptoConstants.RSA_PKCS1_PADDING;
    if (value === 'PSS') return cryptoConstants.RSA_PKCS1_PSS_PADDING;
    throw new InternalServerErrorException(
      'VIETINBANK_RSA_PADDING must be PKCS1 or PSS',
    );
  }

  private normalizePem(value: string): string {
    return value.replace(/\\n/g, '\n');
  }

  private joinNonEmpty(values: Array<string | undefined>): string {
    return values
      .filter((value): value is string => value !== undefined && value !== '')
      .join('');
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }
}
