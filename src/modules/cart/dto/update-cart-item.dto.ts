import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    description: 'New quantity (0 to remove)',
    example: 3,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  quantity: number;
}
