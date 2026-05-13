import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class OrderItemDto extends BaseDto {
  @ApiProperty({
    description: 'Order ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  orderId: string;

  @ApiProperty({
    description: 'Product ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  productId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit price',
    example: 25000,
  })
  unitPrice: number;

  @ApiProperty({
    description: 'Notes',
    example: 'Extra hot',
  })
  notes?: string;

  @ApiProperty({
    description: 'Item status',
    example: 'PENDING',
  })
  status: string;
}
