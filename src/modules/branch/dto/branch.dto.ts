import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class BranchDto extends BaseDto {
  @ApiProperty({ description: 'Branch name', example: 'Main Branch' })
  name: string;

  @ApiProperty({
    description: 'Branch address',
    example: '123 Main Street, City',
  })
  address?: string;

  @ApiProperty({
    description: 'Branch status',
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description: 'Branch-level max debt setting for customers in this branch',
    example: 50000,
  })
  maxCustomerDebt: number;
}
