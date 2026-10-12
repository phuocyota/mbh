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
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCanteenItem?: boolean;
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
