import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryItemService } from './inventory-item.service';

@ApiTags('Inventory Items')
@ApiBearerAuth()
@Controller('inventory-items')
@UseGuards(JwtAuthGuard)
export class InventoryItemController {
  constructor(private readonly inventoryItemService: InventoryItemService) {}

  @Get()
  @ApiOperation({
    summary: 'Compatibility inventory item list backed by products stock',
  })
  @ApiQuery({ name: 'search', required: false })
  async findAll(@Query('search') search?: string) {
    return this.inventoryItemService.findAll(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by product ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async findOne(@Param('id') id: string) {
    return this.inventoryItemService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create inventory item as product stock record' })
  async create(@Body() dto: any) {
    return this.inventoryItemService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update inventory item stock fields' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.inventoryItemService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate inventory item product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async delete(@Param('id') id: string) {
    await this.inventoryItemService.delete(id);
  }
}
