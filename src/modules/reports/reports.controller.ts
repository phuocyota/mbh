import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
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
  async revenueSummary(@Query() query: DateRangeQueryDto, @Req() req: any) {
    return this.reportsService.revenueSummary(query, req.user);
  }

  @Get('revenue/daily')
  @ApiOperation({ summary: 'Doanh thu theo từng ngày' })
  async revenueDaily(@Query() query: DateRangeQueryDto, @Req() req: any) {
    return this.reportsService.revenueDaily(query, req.user);
  }

  @Get('serving')
  @ApiOperation({ summary: 'Thống kê đơn và khách đang phục vụ' })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  async servingStats(
    @Query('branchId') branchId: string | undefined,
    @Req() req: any,
  ) {
    return this.reportsService.servingStats({ branchId }, req.user);
  }

  @Get('customer')
  @ApiOperation({ summary: 'Thống kê lượt khách hàng' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Time filter: today, yesterday, 7days, thisMonth, lastMonth',
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  async customerStats(@Query() query: CustomerReportQueryDto, @Req() req: any) {
    return this.reportsService.customerStats(query, req.user);
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
  async menuPerformance(
    @Query() query: MenuPerformanceQueryDto,
    @Req() req: any,
  ) {
    return this.reportsService.menuPerformance(query, req.user);
  }

  @Get('cancellations')
  @ApiOperation({ summary: 'Báo cáo tình trạng hủy món' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Time filter: today, yesterday, 7days, thisMonth, lastMonth',
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  async cancellationReport(
    @Query() query: CancellationReportQueryDto,
    @Req() req: any,
  ) {
    return this.reportsService.cancellationReport(query, req.user);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top sản phẩm bán chạy' })
  async topProducts(@Query() query: TopProductsQueryDto, @Req() req: any) {
    return this.reportsService.topProducts(query, req.user);
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
  async stockSnapshot(
    @Query('branchId') branchId: string | undefined,
    @Req() req: any,
  ) {
    return this.reportsService.stockSnapshot(branchId, req.user);
  }

  @Get('bottom-products')
  @ApiOperation({ summary: 'Sản phẩm bán chậm nhất (lowSelling)' })
  async bottomProducts(@Query() query: TopProductsQueryDto, @Req() req: any) {
    return this.reportsService.bottomProducts(query, req.user);
  }

  @Get('end-of-day')
  @ApiOperation({
    summary: 'Báo cáo cuối ngày theo sản phẩm (reportDataEndDay)',
  })
  async endOfDay(@Query() query: DateRangeQueryDto, @Req() req: any) {
    return this.reportsService.endOfDay(query, req.user);
  }

  @Get('monthly-order-plan')
  @ApiOperation({
    summary: 'Ke hoach dat hang hoa trong thang',
  })
  async monthlyOrderPlan(
    @Query() query: MonthlyOrderPlanQueryDto,
    @Req() req: any,
  ) {
    return this.reportsService.monthlyOrderPlan(query, req.user);
  }

  @Get('inventory')
  @ApiOperation({
    summary: 'Báo cáo tồn kho chi tiết theo mặt hàng (productInventoryData)',
  })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  async inventoryReport(
    @Query('branchId') branchId: string | undefined,
    @Req() req: any,
  ) {
    return this.reportsService.inventoryReport(branchId, req.user);
  }
}
