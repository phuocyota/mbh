import { IsOptional, IsUUID, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';

export class FullTraceQueryDto {
  @ApiPropertyOptional({ description: 'Lot ID (ưu tiên nếu có)' })
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @ApiPropertyOptional({ description: 'Lot code (dùng khi scan QR/nhập tay)' })
  @IsOptional()
  @IsString()
  lotCode?: string;

  @ApiPropertyOptional({
    description: 'Stock ID — cần khi dùng lotCode để định danh duy nhất',
  })
  @IsOptional()
  @IsUUID()
  stockId?: string;

  @ApiPropertyOptional({
    description: 'Product ID — hỗ trợ resolve khi dùng lotCode',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description:
      'Branch ID — hỗ trợ resolve khi dùng lotCode và không có stockId',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Bao gồm chuỗi di chuyển chi tiết',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeMovements?: boolean = true;

  @ApiPropertyOptional({
    default: true,
    description: 'Bao gồm thông tin consumption (lô dùng cho sản xuất nào)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeConsumption?: boolean = true;

  @ApiPropertyOptional({
    default: true,
    description: 'Bao gồm recipe + ingredients (nếu là FINISHED_GOOD)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeRecipe?: boolean = true;

  @ApiPropertyOptional({
    default: true,
    description: 'Bao gồm timeline hợp nhất cho FE visualization',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeTimeline?: boolean = true;
}

/** Public consumers send a single identity; legacy lot-code filters remain internal. */
export class PublicFullTraceQueryDto extends PickType(FullTraceQueryDto, [
  'includeMovements',
  'includeConsumption',
  'includeRecipe',
  'includeTimeline',
] as const) {
  @ApiProperty({
    description:
      'UUID của lô nguyên/nhiên liệu, lô thành phẩm, mẻ hoặc phần thành phẩm; API tự xác định loại.',
  })
  @IsUUID()
  lotId: string;
}
