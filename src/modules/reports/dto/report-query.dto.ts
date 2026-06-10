import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  IsNumber,
  Min,
  IsIn,
  Matches,
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

const MENU_PERFORMANCE_GROUPS = ['category', 'type'] as const;

export class MenuPerformanceQueryDto extends CustomerReportQueryDto {
  @ApiProperty({
    description:
      'Nhóm dữ liệu biểu đồ: category = theo nhóm món, type = đồ ăn/đồ uống',
    enum: MENU_PERFORMANCE_GROUPS,
    required: false,
    default: 'category',
  })
  @IsOptional()
  @IsIn(MENU_PERFORMANCE_GROUPS)
  groupBy?: (typeof MENU_PERFORMANCE_GROUPS)[number];
}

export class CancellationReportQueryDto extends CustomerReportQueryDto {}

export class EmployeeReportQueryDto extends CustomerReportQueryDto {
  @ApiProperty({
    description:
      'Employee/cashier user ID. Maps to orders.cashier_id in current schema.',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiProperty({
    description: 'Số lượng nhân viên trả về cho biểu đồ top doanh thu',
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

export class MonthlyOrderPlanQueryDto extends DateRangeQueryDto {
  @ApiProperty({
    description:
      'Month for report in YYYY-MM format. Ignored when from/to is provided.',
    required: false,
    example: '2026-06',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @ApiProperty({
    description: 'Minimum plan multiplier',
    required: false,
    default: 1.2,
    example: 1.2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRate?: number;

  @ApiProperty({
    description: 'Maximum plan multiplier',
    required: false,
    default: 1.5,
    example: 1.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxRate?: number;
}
