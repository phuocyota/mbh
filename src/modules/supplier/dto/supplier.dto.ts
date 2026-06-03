import { ApiProperty } from '@nestjs/swagger';

export class SupplierDto {
  @ApiProperty({ description: 'Supplier ID' })
  id: string;

  @ApiProperty({ description: 'Supplier code' })
  code: string;

  @ApiProperty({ description: 'Supplier name' })
  name: string;

  @ApiProperty({ description: 'Phone number', required: false, nullable: true })
  phone?: string;

  @ApiProperty({ description: 'Email', required: false, nullable: true })
  email?: string;

  @ApiProperty({ description: 'Tax code', required: false, nullable: true })
  taxCode?: string;

  @ApiProperty({ description: 'Company name', required: false, nullable: true })
  companyName?: string;

  @ApiProperty({ description: 'Address', required: false, nullable: true })
  address?: string;

  @ApiProperty({ description: 'Province', required: false, nullable: true })
  province?: string;

  @ApiProperty({ description: 'District', required: false, nullable: true })
  district?: string;

  @ApiProperty({ description: 'Ward', required: false, nullable: true })
  ward?: string;

  @ApiProperty({ description: 'ID card number', required: false, nullable: true })
  idCard?: string;

  @ApiProperty({ description: 'Supplier group', required: false, nullable: true })
  group?: string;

  @ApiProperty({ description: 'Note', required: false, nullable: true })
  note?: string;

  @ApiProperty({ description: 'Current debt amount' })
  debt: number;

  @ApiProperty({ description: 'Total purchase amount' })
  totalPurchase: number;

  @ApiProperty({ description: 'Status (active, inactive)' })
  status: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}
