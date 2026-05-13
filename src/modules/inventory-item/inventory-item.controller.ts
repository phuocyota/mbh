import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { InventoryItemService } from './inventory-item.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { InventoryItemDto } from './dto/inventory-item.dto';

@ApiTags('Inventory Items')
@ApiBearerAuth()
@Controller('api/inventory-items')
export class InventoryItemController {
  constructor(private inventoryItemService: InventoryItemService) {}

  @Get()
  @ApiOperation({ summary: 'Get all inventory items' })
  @ApiResponse({
    status: 200,
    description: 'List of inventory items',
    type: [InventoryItemDto],
  })
  async findAll() {
    return this.inventoryItemService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  @ApiParam({ name: 'id', description: 'Inventory Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Inventory item details',
    type: InventoryItemDto,
  })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  async findOne(@Param('id') id: string) {
    return this.inventoryItemService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new inventory item' })
  @ApiResponse({
    status: 201,
    description: 'Inventory item created',
    type: InventoryItemDto,
  })
  async create(@Body() createInventoryItemDto: CreateInventoryItemDto) {
    return this.inventoryItemService.create(createInventoryItemDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update inventory item' })
  @ApiParam({ name: 'id', description: 'Inventory Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Inventory item updated',
    type: InventoryItemDto,
  })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  async update(
    @Param('id') id: string,
    @Body() createInventoryItemDto: CreateInventoryItemDto,
  ) {
    return this.inventoryItemService.update(id, createInventoryItemDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete inventory item' })
  @ApiParam({ name: 'id', description: 'Inventory Item ID' })
  @ApiResponse({ status: 204, description: 'Inventory item deleted' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.inventoryItemService.delete(id, { userId: 'system' } as any);
  }
}
