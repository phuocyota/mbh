import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Dashboard revenue stats by filter' })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  @ApiQuery({ name: 'branchId', required: false })
  getRevenueStats(
    @Req() req: any,
    @Query('filter') filter = '7days',
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getRevenueStats(
      filter,
      req.user?.branchId || branchId,
    );
  }

  @Get('customers')
  @ApiOperation({ summary: 'Dashboard customer stats by filter' })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  @ApiQuery({ name: 'branchId', required: false })
  getCustomerStats(
    @Req() req: any,
    @Query('filter') filter = '7days',
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getCustomerStats(
      filter,
      req.user?.branchId || branchId,
    );
  }

  @Get('recent-activities')
  @ApiOperation({
    summary: 'Recent dashboard activities from orders and stock vouchers',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'branchId', required: false })
  getRecentActivities(
    @Req() req: any,
    @Query('limit') limit?: number,
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getRecentActivities(
      limit,
      req.user?.branchId || branchId,
    );
  }

  @Get('employee-attendance')
  @ApiOperation({
    summary: 'Dashboard employee attendance summary from work schedules',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  getEmployeeAttendance(@Query('filter') filter = 'today') {
    return this.dashboardService.getEmployeeAttendance(filter);
  }

  @Get('revenue/hourly')
  @ApiOperation({ summary: 'Dashboard hourly revenue stats' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  getHourlyRevenueStats(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getHourlyRevenueStats(
      date,
      req.user?.branchId || branchId,
    );
  }

  @Get('customers/hourly')
  @ApiOperation({ summary: 'Dashboard hourly customer stats' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  getHourlyCustomerStats(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getHourlyCustomerStats(
      date,
      req.user?.branchId || branchId,
    );
  }
}
