import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'NV000001' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'CC001', required: false })
  @IsOptional()
  @IsString()
  timekeepingCode?: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '0123456789', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '079123456789', required: false })
  @IsOptional()
  @IsString()
  cccd?: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  debt?: number;

  @ApiProperty({ example: '', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ example: 'working', enum: ['working', 'quit'], required: false })
  @IsOptional()
  @IsIn(['working', 'quit'])
  status?: string;
}
