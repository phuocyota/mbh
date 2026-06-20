import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateStockTakeItemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 10 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  actualQuantity: number;
}

export class CreateStockTakeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [CreateStockTakeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockTakeItemDto)
  items: CreateStockTakeItemDto[];
}
