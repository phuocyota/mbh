import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class WalletDto extends BaseDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  customerId: string;

  @ApiProperty({
    description: 'Current balance',
    example: 50000,
  })
  balance: number;
}
