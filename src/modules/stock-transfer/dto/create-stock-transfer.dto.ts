import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateStockTransferItemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quantity: number;
}

export class CreateStockTransferDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  fromBranchId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  toBranchId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [CreateStockTransferItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferItemDto)
  items: CreateStockTransferItemDto[];
}
