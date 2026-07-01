import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class CustomerMealItemDto extends BaseDto {
  @ApiProperty({ description: 'Customer ID' })
  customerId: string;

  @ApiProperty({ description: 'Meal item ID' })
  mealItemId: string;

  @ApiProperty({ description: 'Requested quantity' })
  quantity: number;

  @ApiProperty({ description: 'Status' })
  status: string;

  @ApiProperty({ description: 'Customer-specific note', required: false })
  note?: string;
}
