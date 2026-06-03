import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ description: 'Status (draft, estimated, finalized, cancelled)', default: 'draft' })
  status?: string;

  @ApiPropertyOptional({ description: 'Note' })
  note?: string;
}
