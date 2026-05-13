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
import { StockLevelService } from './stock-level.service';
import { CreateStockLevelDto } from './dto/create-stock-level.dto';
import { StockLevelDto } from './dto/stock-level.dto';

@ApiTags('Stock Levels')
@ApiBearerAuth()
@Controller('api/stock-levels')
export class StockLevelController {
  constructor(private stockLevelService: StockLevelService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock levels' })
  @ApiResponse({
    status: 200,
    description: 'List of stock levels',
    type: [StockLevelDto],
  })
  async findAll() {
    return this.stockLevelService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock level by ID' })
  @ApiParam({ name: 'id', description: 'Stock Level ID' })
  @ApiResponse({
    status: 200,
    description: 'Stock level details',
    type: StockLevelDto,
  })
  @ApiResponse({ status: 404, description: 'Stock level not found' })
  async findOne(@Param('id') id: string) {
    return this.stockLevelService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new stock level' })
  @ApiResponse({
    status: 201,
    description: 'Stock level created',
    type: StockLevelDto,
  })
  async create(@Body() createStockLevelDto: CreateStockLevelDto) {
    return this.stockLevelService.create(createStockLevelDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update stock level' })
  @ApiParam({ name: 'id', description: 'Stock Level ID' })
  @ApiResponse({
    status: 200,
    description: 'Stock level updated',
    type: StockLevelDto,
  })
  @ApiResponse({ status: 404, description: 'Stock level not found' })
  async update(
    @Param('id') id: string,
    @Body() createStockLevelDto: CreateStockLevelDto,
  ) {
    return this.stockLevelService.update(id, createStockLevelDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete stock level' })
  @ApiParam({ name: 'id', description: 'Stock Level ID' })
  @ApiResponse({ status: 204, description: 'Stock level deleted' })
  @ApiResponse({ status: 404, description: 'Stock level not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.stockLevelService.delete(id, { userId: 'system' } as any);
  }
}
