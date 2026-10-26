import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WorkScheduleService } from './work-schedule.service';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { CreateWeeklyWorkScheduleDto } from './dto/create-weekly-work-schedule.dto';
import { ImportWorkSchedulesDto } from './dto/import-work-schedules.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Work Schedules')
@ApiBearerAuth()
@Controller('work-schedules')
@UseGuards(JwtAuthGuard)
export class WorkScheduleController {
  constructor(private workScheduleService: WorkScheduleService) {}

  @Get('timesheet')
  @ApiOperation({
    summary: 'Lấy bảng chấm công theo tuần (format timeSheetData cho FE)',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    example: '2026-05-25',
    description: 'Ngày bắt đầu tuần (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    example: '2026-05-31',
    description: 'Ngày kết thúc tuần (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    description: 'Lọc theo nhân viên',
  })
  @ApiResponse({ status: 200, description: 'Bảng chấm công theo tuần' })
  async getTimeSheet(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('employeeId') employeeId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.workScheduleService.getWeeklyTimeSheet(
      from,
      to,
      employeeId,
      this.workScheduleService.resolveBranch(req.user, branchId),
    );
  }

  @Get('monthly')
  @ApiOperation({
    summary: 'Lấy lịch làm việc theo tháng (format workScheduleData cho FE)',
  })
  @ApiQuery({ name: 'year', required: true, example: 2026, type: Number })
  @ApiQuery({ name: 'month', required: true, example: 1, type: Number })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    description: 'Lọc theo nhân viên',
  })
  @ApiResponse({ status: 200, description: 'Lịch làm việc theo tháng' })
  async getMonthlySchedule(
    @Req() req: any,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('employeeId') employeeId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.workScheduleService.getMonthlySchedule(
      Number(year),
      Number(month),
      employeeId,
      this.workScheduleService.resolveBranch(req.user, branchId),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một lịch làm việc' })
  @ApiParam({ name: 'id', description: 'WorkSchedule ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết lịch làm việc' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.workScheduleService.findOneForUser(id, req.user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo lịch làm việc mới cho nhân viên' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async create(@Req() req: any, @Body() dto: CreateWorkScheduleDto) {
    return this.workScheduleService.create(dto, req.user);
  }

  @Post('weekly-repeat')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create work schedules from a weekly template' })
  @ApiResponse({ status: 201, description: 'Created successfully' })
  async createWeeklySchedule(
    @Req() req: any,
    @Body() dto: CreateWeeklyWorkScheduleDto,
  ) {
    return this.workScheduleService.createWeeklySchedule(dto, req.user);
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Import tối đa 500 lịch làm việc trong một transaction',
  })
  async importSchedules(@Req() req: any, @Body() dto: ImportWorkSchedulesDto) {
    return this.workScheduleService.importSchedules(dto, req.user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật lịch làm việc' })
  @ApiParam({ name: 'id', description: 'WorkSchedule ID' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateWorkScheduleDto,
  ) {
    return this.workScheduleService.update(id, dto, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa lịch làm việc' })
  @ApiParam({ name: 'id', description: 'WorkSchedule ID' })
  @ApiResponse({ status: 204, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async delete(@Req() req: any, @Param('id') id: string): Promise<void> {
    await this.workScheduleService.hardDelete(id, req.user);
  }
}
