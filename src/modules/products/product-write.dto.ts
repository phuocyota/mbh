import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ProductWriteDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() clearMinimumStock?: boolean;
  @ApiPropertyOptional({
    description: 'Định mức tồn tối thiểu theo đơn vị cơ sở, áp dụng từng kho',
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() baseUnitId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ingredients?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @ApiPropertyOptional({
    description: 'Legacy field; stock is changed only via warehouse APIs',
  })
  @IsOptional()
  @IsNumber()
  quantity?: number;
  @ApiPropertyOptional({
    nullable: true,
    enum: ['INGREDIENT', 'FUEL', 'FINISHED_GOOD', 'MERCHANDISE'],
  })
  @IsOptional()
  @IsIn(['INGREDIENT', 'FUEL', 'FINISHED_GOOD', 'MERCHANDISE'])
  productType?: string | null;
  @ApiPropertyOptional({ description: 'Món phải qua chế biến tại bếp' })
  @IsOptional()
  @IsBoolean()
  requiresCooking?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCanteenItem?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isBoarding?: boolean;
  @ApiPropertyOptional({
    description: 'Hàng tươi sống, hạn dùng mặc định 7 ngày sau ngày mua',
  })
  @IsOptional()
  @IsBoolean()
  isFreshFood?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresSample?: boolean;
  @ApiPropertyOptional({
    description: 'Read-only activation; use stock-lots/opening',
  })
  @IsOptional()
  @IsBoolean()
  lotTrackingEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) cookDuration?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  recommendedUseMinutes?: number;
}
