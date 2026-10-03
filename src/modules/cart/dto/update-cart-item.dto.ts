import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsOptional, IsString, Min } from 'class-validator';

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

  @ApiProperty({
    description:
      'Ghi chú cho món. Không truyền thì giữ nguyên, chuỗi rỗng dùng để xóa ghi chú.',
    example: 'Không cay',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
