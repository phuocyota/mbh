import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PAYROLL_STATUS,
  PAYROLL_STATUS_VALUES,
} from '../../../common/constant/constant';

export class CreatePayrollDto {
  @ApiProperty({ description: 'Payroll name' })
  name: string;

  @ApiPropertyOptional({ description: 'Payment cycle (monthly, custom)', default: 'monthly' })
  cycle?: string;

  @ApiProperty({ description: 'Period start date (DD/MM/YYYY)' })
  periodStart: string;

  @ApiProperty({ description: 'Period end date (DD/MM/YYYY)' })
  periodEnd: string;

  @ApiPropertyOptional({ description: 'Total salary amount', default: 0 })
  totalSalary?: number;

  @ApiPropertyOptional({ description: 'Amount paid to employees', default: 0 })
  paid?: number;

  @ApiPropertyOptional({
    description: 'Status',
    enum: PAYROLL_STATUS_VALUES,
    default: PAYROLL_STATUS.DRAFT,
  })
  status?: string;

  @ApiPropertyOptional({ description: 'Note' })
  note?: string;
}
