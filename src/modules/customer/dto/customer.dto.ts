import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class CustomerDto extends BaseDto {
  @ApiProperty({
    description: 'Customer code',
    example: 'CUST001',
  })
  customerCode: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
  })
  fullName: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+84123456789',
  })
  phone?: string;

  @ApiProperty({
    description: 'Customer type',
    example: 'GUEST',
  })
  type: string;

  @ApiProperty({
    description: 'Customer status',
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description:
      'Maximum total debt for this customer; defaults to 50000 and is not changed by wallet transactions',
    example: 50000,
  })
  debtLimit: number;

  @ApiPropertyOptional({
    description:
      'Current debt derived from a negative wallet balance; returned when getDebt=true',
    example: 25000,
  })
  debt?: number;
}
