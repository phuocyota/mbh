import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class UserDto extends BaseDto {
  @ApiProperty({ description: 'Full name', example: 'John Doe' })
  fullName: string;

  @ApiProperty({ description: 'Phone number', example: '+84123456789' })
  phone?: string;

  @ApiProperty({ description: 'Email address', example: 'john@example.com' })
  email?: string;

  @ApiProperty({ description: 'Password hash' })
  passwordHash: string;

  @ApiProperty({
    description: 'User role',
    example: 'STAFF',
  })
  role: string;

  @ApiProperty({
    description: 'User status',
    example: 'ACTIVE',
  })
  status: string;
}
