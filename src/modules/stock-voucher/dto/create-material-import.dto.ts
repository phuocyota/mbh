import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class MaterialImportItemDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty({ description: 'Mã lô của sản phẩm tại nhà cung cấp' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lotCode: string;
  @ApiProperty({
    description: 'Số lượng theo unitId, hoặc đơn vị cơ sở nếu không có unitId',
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity: number;
  @ApiProperty({ description: 'Đơn giá theo đơn vị nhập, 0 nếu miễn phí' })
  @IsNumber()
  @Min(0)
  unitPrice: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional({ example: '2026-10-19' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  manufacturedAt?: string;
  @ApiPropertyOptional({
    description: 'Bắt buộc với nguyên liệu, có thể bỏ trống với nhiên liệu',
    example: '2026-10-25',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expiresAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class CreateMaterialImportDto {
  @ApiProperty({
    description:
      'UUID chống nhập trùng khi gửi lại yêu cầu; dùng UUID mới cho mỗi phiếu',
  })
  @IsUUID()
  requestId: string;
  @ApiProperty() @IsUUID() supplierId: string;
  @ApiProperty({ enum: ['PAID', 'UNPAID', 'DEBT'] })
  @IsIn(['PAID', 'UNPAID', 'DEBT'])
  paymentStatus: string;
  @ApiPropertyOptional({
    description: 'Chỉ ADMIN có thể chọn chi nhánh khác; mặc định lấy JWT',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reasonCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiProperty({ type: [MaterialImportItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => MaterialImportItemDto)
  items: MaterialImportItemDto[];
}
