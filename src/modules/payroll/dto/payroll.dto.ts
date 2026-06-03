import { ApiProperty } from '@nestjs/swagger';

export class PayrollDto {
  @ApiProperty({ description: 'Payroll ID' })
  id: string;

  @ApiProperty({ description: 'Payroll code' })
  code: string;

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

  @ApiProperty({ description: 'Status (draft, estimated, finalized, cancelled)' })
  status: string;

  @ApiProperty({ description: 'Note', required: false, nullable: true })
  note?: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}
