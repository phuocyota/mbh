import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsString,
  IsInt,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class KioskCheckoutItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Số lượng', example: 1 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class KioskCheckoutDto {
  @ApiProperty({ description: 'Card UID đã quét', example: 'NFCSTU00001' })
  @IsNotEmpty()
  @IsString()
  cardUid: string;

  @ApiProperty({ description: 'Branch ID (canteen / chi nhánh)' })
  @IsNotEmpty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'POS Device ID (kiosk)' })
  @IsNotEmpty()
  @IsUUID()
  posDeviceId: string;

  @ApiProperty({
    description: 'Danh sách món',
    type: [KioskCheckoutItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => KioskCheckoutItemDto)
  items: KioskCheckoutItemDto[];

  @ApiProperty({ description: 'Ghi chú', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
