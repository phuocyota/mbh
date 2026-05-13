import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class KitchenTicketItemDto extends BaseDto {
  @ApiProperty({
    description: 'Kitchen Ticket ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  kitchenTicketId: string;

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
    description: 'Item status',
    example: 'PENDING',
  })
  status: string;

  @ApiProperty({
    description: 'Cooking notes',
    example: 'Extra hot, no sugar',
  })
  notes?: string;
}
