import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue statistics by filter' })
  @ApiQuery({ 
    name: 'filter', 
    required: false, 
    description: 'Time filter: today, yesterday, 7days, thisMonth, lastMonth',
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  async revenueStats(
    @Query('filter') filter: string = '7days',
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getRevenueStats(filter, branchId);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get customer statistics by filter' })
  @ApiQuery({ 
    name: 'filter', 
    required: false, 
    description: 'Time filter: today, yesterday, 7days, thisMonth, lastMonth',
    enum: ['today', 'yesterday', '7days', 'thisMonth', 'lastMonth'],
  })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  async customerStats(
    @Query('filter') filter: string = '7days',
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getCustomerStats(filter, branchId);
  }
}
