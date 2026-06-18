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

export class StockTakeItemInputDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 10 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  actualQuantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateStockTakeDto {
  @ApiProperty({ example: DEFAULT_BRANCH_ID, required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  countedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [StockTakeItemInputDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTakeItemInputDto)
  items?: StockTakeItemInputDto[];
}

export class UpdateStockTakeItemsDto {
  @ApiProperty({ type: [StockTakeItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTakeItemInputDto)
  items: StockTakeItemInputDto[];
}
