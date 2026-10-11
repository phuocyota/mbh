import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VietinBankNotifyDto {
  @ApiProperty()
  msgId: string;

  @ApiProperty()
  providerId: string;

  @ApiProperty()
  transId: string;

  @ApiProperty()
  transTime: string;

  @ApiPropertyOptional()
  transType?: string;

  @ApiPropertyOptional()
  custCode?: string;

  @ApiPropertyOptional()
  sendBankId?: string;

  @ApiPropertyOptional()
  sendBranchId?: string;

  @ApiPropertyOptional()
  sendAcctId?: string;

  @ApiPropertyOptional()
  sendAcctName?: string;

  @ApiProperty()
  recvAcctId: string;

  @ApiPropertyOptional()
  recvAcctName?: string;

  @ApiPropertyOptional()
  recvVirtualAcctId?: string;

  @ApiPropertyOptional()
  recvVirtualAcctName?: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  bankTransId: string;

  @ApiPropertyOptional()
  remark?: string;

  @ApiProperty({ default: 'VND' })
  currencyCode: string;

  @ApiProperty()
  signature: string;
}

export interface VietinBankNotifyResponse {
  transId: string;
  providerId: string;
  errorCode: string;
  errorDesc: string;
  signature: string;
}

export interface VietinBankQrResult {
  qrContent: string;
  qrBase64: string | null;
  providerRequestId: string;
  mock: boolean;
}
