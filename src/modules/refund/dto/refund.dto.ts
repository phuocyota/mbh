import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class RefundDto extends BaseDto {
  @ApiProperty({
    description: 'Order ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  orderId: string;

  @ApiProperty({
    description: 'Refund amount',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Refund reason',
    example: 'Customer request',
  })
  reason: string;

  @ApiProperty({
    description: 'Refund status',
    example: 'COMPLETED',
  })
  status: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Approved by manager',
  })
  notes?: string;
}
