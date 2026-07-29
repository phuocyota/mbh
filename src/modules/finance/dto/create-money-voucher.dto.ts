import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateMoneyVoucherDto {
  @ApiProperty({ example: 'RECEIPT' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: false,
    description:
      'Legacy fund hint. If provided, it must match the accounting_formula of reasonCode.',
  })
  @IsOptional()
  @IsUUID()
  fundId?: string;

  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: false,
    description:
      'Branch used to resolve the unique active fund from accounting_formula.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: 100000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ example: 'ORDER_PAYMENT', required: false })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty({
    example: 'BT_CN_KH_NCC',
    required: false,
    description:
      'Accounting reason selected by BE business mapping. Required only for internal/specialized flows without paymentMethod.',
  })
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiProperty({
    example: 'CASH',
    required: false,
    description:
      'Business payment method. Public receipt/payment APIs map this field to a reasonCode in BE.',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  refType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  refId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
