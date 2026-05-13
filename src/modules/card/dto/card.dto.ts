import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class CardDto extends BaseDto {
  @ApiProperty({
    description: 'Customer ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  customerId: string;

  @ApiProperty({
    description: 'Card UID',
    example: 'CARD123456',
  })
  cardUid: string;

  @ApiProperty({
    description: 'Card number',
    example: '0123456789ABCDEF',
  })
  cardNumber: string;

  @ApiProperty({
    description: 'Card status',
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description: 'Issued date',
    example: '2024-01-15T00:00:00Z',
  })
  issuedAt?: Date;
}
