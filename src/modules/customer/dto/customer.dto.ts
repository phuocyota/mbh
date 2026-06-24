import { ApiProperty } from '@nestjs/swagger';
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
      'Remaining debt allowance for this customer; actual debt is based on wallet balance',
    example: 50000,
  })
  debtLimit: number;
}
