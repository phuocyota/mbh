import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class StockLevelDto extends BaseDto {
  @ApiProperty({
    description: 'Branch ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  branchId: string;

  @ApiProperty({
    description: 'Product ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  productId: string;

  @ApiProperty({
    description: 'Current quantity',
    example: 50,
  })
  quantity: number;

  @ApiProperty({
    description: 'Minimum threshold',
    example: 10,
  })
  minThreshold?: number;

  @ApiProperty({
    description: 'Maximum capacity',
    example: 100,
  })
  maxCapacity?: number;
}
