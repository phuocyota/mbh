import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateStockTakeDto,
  UpdateStockTakeItemsDto,
} from './dto/stock-take.dto';
import { StockTakeService } from './stock-take.service';

@ApiTags('Stock Takes')
@ApiBearerAuth()
@Controller('stock-takes')
@UseGuards(JwtAuthGuard)
export class StockTakeController {
  constructor(private readonly stockTakeService: StockTakeService) {}

  @Get()
  @ApiOperation({ summary: 'List stock take vouchers' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  findAll(
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.stockTakeService.findAll({ status, branchId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock take detail' })
  findOne(@Param('id') id: string) {
    return this.stockTakeService.findOne(id);
  }

  @Post('drafts')
  @ApiOperation({ summary: 'Create stock take draft' })
  createDraft(@Body() dto: CreateStockTakeDto) {
    return this.stockTakeService.createDraft(dto);
  }

  @Put(':id/items')
  @ApiOperation({ summary: 'Replace stock take draft items' })
  updateItems(@Param('id') id: string, @Body() dto: UpdateStockTakeItemsDto) {
    return this.stockTakeService.replaceItems(id, dto.items);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete stock take and adjust product stock' })
  complete(@Param('id') id: string) {
    return this.stockTakeService.complete(id);
  }
}
