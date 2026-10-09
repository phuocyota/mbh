import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateStockTransferItemDto {
  @ApiProperty({ required: false }) @IsOptional() @IsArray() allocations?: {
    lotId: string;
    quantity: number;
  }[];
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() unitId?: string;
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
  actorId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() requestId?: string;
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
