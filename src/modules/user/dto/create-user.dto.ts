import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import {
  ACTIVE_INACTIVE_STATUS_VALUES,
  COMMON_STATUS,
  USER_ROLE,
  USER_ROLE_VALUES,
} from '../../../common/constant/constant';

export class CreateUserDto {
  @ApiProperty({ description: 'Full name of the user', example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+84123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Password hash',
    example: 'hashed_password_here',
  })
  @IsNotEmpty()
  @IsString()
  passwordHash: string;

  @ApiProperty({
    description: 'User role',
    enum: USER_ROLE_VALUES,
    default: USER_ROLE.STAFF,
  })
  @IsOptional()
  @IsEnum(USER_ROLE_VALUES)
  role?: string;

  @ApiProperty({
    description: 'User status',
    enum: ACTIVE_INACTIVE_STATUS_VALUES,
    default: COMMON_STATUS.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ACTIVE_INACTIVE_STATUS_VALUES)
  status?: string;

  @ApiProperty({
    description: 'Branch ID for manager users',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    description: 'Card ID for RFID/card login',
    example: '0089280076',
    required: false,
  })
  @IsOptional()
  @IsString()
  cardId?: string;
}
