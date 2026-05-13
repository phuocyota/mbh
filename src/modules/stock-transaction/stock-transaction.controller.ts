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
import { StockTransactionService } from './stock-transaction.service';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { StockTransactionDto } from './dto/stock-transaction.dto';

@ApiTags('Stock Transactions')
@ApiBearerAuth()
@Controller('stock-transactions')
export class StockTransactionController {
  constructor(private stockTransactionService: StockTransactionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock transactions' })
  @ApiResponse({
    status: 200,
    description: 'List of stock transactions',
    type: [StockTransactionDto],
  })
  async findAll() {
    return this.stockTransactionService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock transaction by ID' })
  @ApiParam({ name: 'id', description: 'Stock Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Stock transaction details',
    type: StockTransactionDto,
  })
  @ApiResponse({ status: 404, description: 'Stock transaction not found' })
  async findOne(@Param('id') id: string) {
    return this.stockTransactionService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new stock transaction' })
  @ApiResponse({
    status: 201,
    description: 'Stock transaction created',
    type: StockTransactionDto,
  })
  async create(@Body() createStockTransactionDto: CreateStockTransactionDto) {
    return this.stockTransactionService.create(createStockTransactionDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update stock transaction' })
  @ApiParam({ name: 'id', description: 'Stock Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Stock transaction updated',
    type: StockTransactionDto,
  })
  @ApiResponse({ status: 404, description: 'Stock transaction not found' })
  async update(
    @Param('id') id: string,
    @Body() createStockTransactionDto: CreateStockTransactionDto,
  ) {
    return this.stockTransactionService.update(id, createStockTransactionDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete stock transaction' })
  @ApiParam({ name: 'id', description: 'Stock Transaction ID' })
  @ApiResponse({ status: 204, description: 'Stock transaction deleted' })
  @ApiResponse({ status: 404, description: 'Stock transaction not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.stockTransactionService.delete(id, { userId: 'system' } as any);
  }
}
