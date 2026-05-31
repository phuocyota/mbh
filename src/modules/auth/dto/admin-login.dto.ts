import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Admin/Manager/Staff email',
    example: 'admin@kidocanteen.vn',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password',
    example: 'admin123',
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}
