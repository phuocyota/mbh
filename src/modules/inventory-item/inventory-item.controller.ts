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
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async findAll(
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.inventoryItemService.findAll(search, page, size, branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by product ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiQuery({ name: 'branchId', required: false })
  async findOne(@Param('id') id: string, @Query('branchId') branchId?: string) {
    return this.inventoryItemService.findOne(id, branchId);
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
