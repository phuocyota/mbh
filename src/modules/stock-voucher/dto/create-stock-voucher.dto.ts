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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  fundId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  debitAccountCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  creditAccountCode?: string;

  @ApiProperty({ type: [CreateStockVoucherItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockVoucherItemDto)
  items: CreateStockVoucherItemDto[];
}
