import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DateRangeQueryDto {
  @ApiProperty({
    description: 'Từ ngày (ISO YYYY-MM-DD hoặc datetime)',
    required: false,
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({
    description: 'Đến ngày (ISO YYYY-MM-DD hoặc datetime). Mặc định: hôm nay',
    required: false,
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({
    description: 'Branch ID (lọc theo chi nhánh)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class TopProductsQueryDto extends DateRangeQueryDto {
  @ApiProperty({
    description: 'Số lượng sản phẩm trả về',
    required: false,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

const CUSTOMER_REPORT_FILTERS = [
  'today',
  'yesterday',
  '7days',
  'thisMonth',
  'lastMonth',
] as const;

export class CustomerReportQueryDto extends DateRangeQueryDto {
  @ApiProperty({
    description:
      'Preset khoảng thời gian. Bị bỏ qua nếu truyền from/to cụ thể.',
    enum: CUSTOMER_REPORT_FILTERS,
    required: false,
    default: '7days',
  })
  @IsOptional()
  @IsIn(CUSTOMER_REPORT_FILTERS)
  filter?: (typeof CUSTOMER_REPORT_FILTERS)[number];
}
