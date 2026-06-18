import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';

export class StockTransferItemInputDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateStockTransferDto {
  @ApiProperty({ example: DEFAULT_BRANCH_ID })
  @IsNotEmpty()
  @IsUUID()
  fromBranchId: string;

  @ApiProperty({ example: DEFAULT_BRANCH_ID })
  @IsNotEmpty()
  @IsUUID()
  toBranchId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  transferredAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [StockTransferItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemInputDto)
  items: StockTransferItemInputDto[];
}
