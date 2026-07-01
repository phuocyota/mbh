import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';

export class CreateStockVoucherItemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 10000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateStockVoucherDto {
  @ApiProperty({ example: DEFAULT_BRANCH_ID, required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  fromBranchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  toBranchId?: string;

  @ApiProperty({ example: 'IMPORT' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ required: false, description: 'Destination ID (e.g. supplier, customer)' })
  @IsOptional()
  @IsUUID()
  toId?: string;

  @ApiProperty({ required: false, description: 'Destination type (e.g. supplier, customer)' })
  @IsOptional()
  @IsString()
  toType?: string;

  @ApiProperty({ required: false, description: 'Reference ID (e.g. order ID)' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiProperty({ required: false, description: 'Reference type (e.g. order)' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  fundId?: string;

  @ApiProperty({
    required: false,
    description: 'Accounting reason code from stock_fund_receipt_reason.',
  })
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    required: false,
    description: 'Payment mode for supplier imports. Use PAID for immediate payment; omit or use DEBT for supplier debt.',
  })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  isPaid?: boolean;

  @ApiProperty({ type: [CreateStockVoucherItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockVoucherItemDto)
  items: CreateStockVoucherItemDto[];
}
