import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Supplier name' })
  name: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Email' })
  email?: string;

  @ApiPropertyOptional({ description: 'Tax code' })
  taxCode?: string;

  @ApiPropertyOptional({ description: 'Company name' })
  companyName?: string;

  @ApiPropertyOptional({ description: 'Address' })
  address?: string;

  @ApiPropertyOptional({ description: 'Province' })
  province?: string;

  @ApiPropertyOptional({ description: 'District' })
  district?: string;

  @ApiPropertyOptional({ description: 'Ward' })
  ward?: string;

  @ApiPropertyOptional({ description: 'ID card number' })
  idCard?: string;

  @ApiPropertyOptional({ description: 'Supplier group' })
  group?: string;

  @ApiPropertyOptional({ description: 'Note' })
  note?: string;

  @ApiPropertyOptional({ description: 'Status (active, inactive)', default: 'active' })
  status?: string;
}
