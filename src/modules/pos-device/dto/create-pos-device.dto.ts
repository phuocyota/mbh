import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { DEFAULT_BRANCH_ID } from '../../../common/constant/default-branch.constant';

export class CreatePOSDeviceDto {
  @ApiProperty({
    description: 'Branch ID',
    example: DEFAULT_BRANCH_ID,
    required: false,
    default: DEFAULT_BRANCH_ID,
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    description: 'Device name',
    example: 'POS Terminal 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Device serial number',
    example: 'SN12345678',
  })
  @IsNotEmpty()
  @IsString()
  serialNumber: string;

  @ApiProperty({
    description: 'Device status',
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
    default: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'MAINTENANCE'])
  status?: string;
}
