import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class POSDeviceDto extends BaseDto {
  @ApiProperty({
    description: 'Branch ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  branchId: string;

  @ApiProperty({
    description: 'Device name',
    example: 'POS Terminal 1',
  })
  name: string;

  @ApiProperty({
    description: 'Device serial number',
    example: 'SN12345678',
  })
  serialNumber: string;

  @ApiProperty({
    description: 'Device status',
    example: 'ACTIVE',
  })
  status: string;
}
