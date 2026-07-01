import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class WalletTransactionDto extends BaseDto {
  @ApiProperty({
    description: 'Wallet ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  walletId: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 10000,
  })
  amount: number;

  @ApiProperty({
    description: 'Transaction type',
    example: 'DEPOSIT',
  })
  transactionType: string;

  @ApiProperty({
    description: 'Reference ID',
    example: 'ORDER123',
  })
  referenceId?: string;

  @ApiProperty({
    description: 'Accounting reason code',
    example: 'TT_TRA_CHAM',
    required: false,
  })
  reasonCode?: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Top up wallet',
  })
  notes?: string;
}
