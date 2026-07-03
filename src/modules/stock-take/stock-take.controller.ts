import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.stockTakeService.findAll({
      status,
      branchId: req.user?.branchId || branchId,
      page,
      size,
    });
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
