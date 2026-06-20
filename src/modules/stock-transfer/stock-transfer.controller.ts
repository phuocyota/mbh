import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StockTransferService } from './stock-transfer.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';

@ApiTags('Stock Transfers')
@ApiBearerAuth()
@Controller('stock-transfers')
@UseGuards(JwtAuthGuard)
export class StockTransferController {
  constructor(private readonly stockTransferService: StockTransferService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock transfers' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'fromBranchId', required: false })
  @ApiQuery({ name: 'toBranchId', required: false })
  findAll(
    @Query('status') status?: string,
    @Query('fromBranchId') fromBranchId?: string,
    @Query('toBranchId') toBranchId?: string,
  ) {
    return this.stockTransferService.findAll({ status, fromBranchId, toBranchId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock transfer by ID' })
  findOne(@Param('id') id: string) {
    return this.stockTransferService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a draft stock transfer' })
  create(@Body() dto: CreateStockTransferDto) {
    return this.stockTransferService.create(dto);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a stock transfer' })
  complete(@Param('id') id: string) {
    return this.stockTransferService.complete(id);
  }
}
