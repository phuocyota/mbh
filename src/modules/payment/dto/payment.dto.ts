import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class PaymentDto extends BaseDto {
  @ApiProperty({
    description: 'Order ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  orderId: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 100000,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    example: 'CASH',
  })
  paymentMethod: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'COMPLETED',
  })
  status: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Paid in full',
  })
  notes?: string;
}
