import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  DateRangeQueryDto,
  TopProductsQueryDto,
} from './dto/report-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @ApiOperation({
    summary: 'Tổng doanh thu trong khoảng + breakdown phương thức TT',
  })
  async revenueSummary(@Query() query: DateRangeQueryDto) {
    return this.reportsService.revenueSummary(query);
  }

  @Get('revenue/daily')
  @ApiOperation({ summary: 'Doanh thu theo từng ngày' })
  async revenueDaily(@Query() query: DateRangeQueryDto) {
    return this.reportsService.revenueDaily(query);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top sản phẩm bán chạy' })
  async topProducts(@Query() query: TopProductsQueryDto) {
    return this.reportsService.topProducts(query);
  }

  @Get('shifts/:shiftId/summary')
  @ApiOperation({
    summary: 'Tổng kết 1 ca làm việc (doanh thu, cash, expected vs closing)',
  })
  @ApiParam({ name: 'shiftId', description: 'Shift ID' })
  async shiftSummary(@Param('shiftId') shiftId: string) {
    return this.reportsService.shiftSummary(shiftId);
  }

  @Get('stock')
  @ApiOperation({ summary: 'Tồn kho hiện tại (theo chi nhánh nếu có)' })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  async stockSnapshot(@Query('branchId') branchId?: string) {
    return this.reportsService.stockSnapshot(branchId);
  }
}
