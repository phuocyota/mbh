import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductRecipeItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  ingredientProductId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requiredLotId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  wasteFactor?: number;
}

export class CreateProductRecipeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  yieldQuantity: number;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  yieldUnitId: string;

  @ApiPropertyOptional({ default: 'DRAFT' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  standardCost?: number;

  @ApiProperty({ type: [CreateProductRecipeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductRecipeItemDto)
  items: CreateProductRecipeItemDto[];
}

export class UpdateProductRecipeDto extends CreateProductRecipeDto {}

export class RecipeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({ default: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;
}
