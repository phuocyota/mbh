import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class RefundItemDto extends BaseDto {
  @ApiProperty({
    description: 'Refund ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  refundId: string;

  @ApiProperty({
    description: 'Order Item ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  orderItemId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 1,
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit price',
    example: 25000,
  })
  unitPrice: number;

  @ApiProperty({
    description: 'Reason for refund',
    example: 'Damaged item',
  })
  reason?: string;
}
