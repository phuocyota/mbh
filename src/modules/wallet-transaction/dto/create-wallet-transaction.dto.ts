import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateWalletTransactionDto {
  @ApiProperty({
    description: 'Wallet ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsUUID()
  walletId: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 10000,
  })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Transaction type',
    example: 'DEPOSIT',
  })
  @IsNotEmpty()
  @IsString()
  transactionType: string;

  @ApiProperty({
    description: 'Reference ID',
    example: 'ORDER123',
    required: false,
  })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Top up wallet',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
