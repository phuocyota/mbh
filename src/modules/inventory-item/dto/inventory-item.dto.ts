import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from '../../../common/dto/base.dto';

export class InventoryItemDto extends BaseDto {
  @ApiProperty({
    description: 'Item name',
    example: 'Sugar',
  })
  name: string;

  @ApiProperty({
    description: 'Item SKU',
    example: 'INV-SUGAR-001',
  })
  sku: string;

  @ApiProperty({
    description: 'Quantity on hand',
    example: 100,
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'kg',
  })
  unit: string;

  @ApiProperty({
    description: 'Cost per unit',
    example: 10000,
  })
  costPerUnit?: number;

  @ApiProperty({
    description: 'Item status',
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    description: 'Notes',
    example: 'Storage in warehouse A',
  })
  notes?: string;
}
