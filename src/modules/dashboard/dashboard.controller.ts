import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
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
    @Query('filter') filter = '7days',
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getRevenueStats(filter, branchId);
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
    @Query('filter') filter = '7days',
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getCustomerStats(filter, branchId);
  }

  @Get('recent-activities')
  @ApiOperation({ summary: 'Recent dashboard activities from orders and warehouse vouchers' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'branchId', required: false })
  getRecentActivities(
    @Query('limit') limit?: number,
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getRecentActivities(limit, branchId);
  }

  @Get('employee-attendance')
  @ApiOperation({ summary: 'Dashboard employee attendance summary from work schedules' })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  getEmployeeAttendance(@Query('filter') filter = 'today') {
    return this.dashboardService.getEmployeeAttendance(filter);
  }
}
