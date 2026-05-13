import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class CategoryDto extends BaseDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Beverages',
  })
  name: string;

  @ApiProperty({
    description: 'Category description',
    example: 'All beverages and drinks',
  })
  description?: string;

  @ApiProperty({
    description: 'Sort order',
    example: 1,
  })
  sortOrder?: number;

  @ApiProperty({
    description: 'Category status',
    example: 'ACTIVE',
  })
  status: string;
}
