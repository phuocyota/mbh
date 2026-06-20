import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StockTakeService } from './stock-take.service';
import { CreateStockTakeDto } from './dto/create-stock-take.dto';

@ApiTags('Stock Takes')
@ApiBearerAuth()
@Controller('stock-takes')
@UseGuards(JwtAuthGuard)
export class StockTakeController {
  constructor(private readonly stockTakeService: StockTakeService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock takes' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  findAll(
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.stockTakeService.findAll({ status, branchId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock take by ID' })
  findOne(@Param('id') id: string) {
    return this.stockTakeService.findOne(id);
  }

  @Post('drafts')
  @ApiOperation({ summary: 'Create a draft stock take' })
  createDraft(@Body() dto: CreateStockTakeDto) {
    return this.stockTakeService.createDraft(dto);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a stock take' })
  complete(@Param('id') id: string) {
    return this.stockTakeService.complete(id);
  }
}
