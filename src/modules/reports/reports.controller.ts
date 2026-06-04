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
  CancellationReportQueryDto,
  CustomerReportQueryDto,
  DateRangeQueryDto,
  MenuPerformanceQueryDto,
  MonthlyOrderPlanQueryDto,
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

  @Get('serving')
  @ApiOperation({ summary: 'Thống kê đơn và khách đang phục vụ' })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  async servingStats(@Query('branchId') branchId?: string) {
    return this.reportsService.servingStats({ branchId });
  }

  @Get('customer')
  @ApiOperation({ summary: 'Thống kê lượt khách hàng' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Time filter: today, yesterday, 7days, thisMonth, lastMonth',
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  async customerStats(@Query() query: CustomerReportQueryDto) {
    return this.reportsService.customerStats(query);
  }

  @Get('menu-performance')
  @ApiOperation({ summary: 'Báo cáo hiệu quả thực đơn' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Time filter: today, yesterday, 7days, thisMonth, lastMonth',
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    description: 'category = theo nhóm món, type = đồ ăn/đồ uống',
    enum: ['category', 'type'],
  })
  async menuPerformance(@Query() query: MenuPerformanceQueryDto) {
    return this.reportsService.menuPerformance(query);
  }

  @Get('cancellations')
  @ApiOperation({ summary: 'Báo cáo tình trạng hủy món' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Time filter: today, yesterday, 7days, thisMonth, lastMonth',
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  async cancellationReport(@Query() query: CancellationReportQueryDto) {
    return this.reportsService.cancellationReport(query);
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

  @Get('bottom-products')
  @ApiOperation({ summary: 'Sản phẩm bán chậm nhất (lowSelling)' })
  async bottomProducts(@Query() query: TopProductsQueryDto) {
    return this.reportsService.bottomProducts(query);
  }

  @Get('end-of-day')
  @ApiOperation({
    summary: 'Báo cáo cuối ngày theo sản phẩm (reportDataEndDay)',
  })
  async endOfDay(@Query() query: DateRangeQueryDto) {
    return this.reportsService.endOfDay(query);
  }

  @Get('monthly-order-plan')
  @ApiOperation({
    summary: 'Ke hoach dat hang hoa trong thang',
  })
  async monthlyOrderPlan(@Query() query: MonthlyOrderPlanQueryDto) {
    return this.reportsService.monthlyOrderPlan(query);
  }

  @Get('inventory')
  @ApiOperation({
    summary: 'Báo cáo tồn kho chi tiết theo mặt hàng (productInventoryData)',
  })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  async inventoryReport(@Query('branchId') branchId?: string) {
    return this.reportsService.inventoryReport(branchId);
  }
}
