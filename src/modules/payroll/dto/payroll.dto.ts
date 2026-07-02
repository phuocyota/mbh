import { ApiProperty } from '@nestjs/swagger';
import { PAYROLL_STATUS_VALUES } from '../../../common/constant/constant';

export class PayrollDto {
  @ApiProperty({ description: 'Payroll ID' })
  id: string;

  @ApiProperty({ description: 'Payroll code' })
  code: string;

  @ApiProperty({ description: 'Branch ID', required: false, nullable: true })
  branchId?: string | null;

  @ApiProperty({ description: 'Payroll name' })
  name: string;

  @ApiProperty({ description: 'Payment cycle (monthly, custom)' })
  cycle: string;

  @ApiProperty({ description: 'Period start date (DD/MM/YYYY)' })
  periodStart: string;

  @ApiProperty({ description: 'Period end date (DD/MM/YYYY)' })
  periodEnd: string;

  @ApiProperty({ description: 'Total salary amount' })
  totalSalary: number;

  @ApiProperty({ description: 'Amount paid to employees' })
  paid: number;

  @ApiProperty({ description: 'Remaining amount to pay' })
  remaining: number;

  @ApiProperty({ description: 'Status', enum: PAYROLL_STATUS_VALUES })
  status: string;

  @ApiProperty({ description: 'Note', required: false, nullable: true })
  note?: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}
