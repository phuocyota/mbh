import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { PayrollDto } from './dto/payroll.dto';
import {
  PAYROLL_STATUS_FILTER_ALL,
  PAYROLL_STATUS_VALUES,
} from '../../common/constant/constant';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Payrolls')
@ApiBearerAuth()
@Controller('payrolls')
export class PayrollController {
  constructor(private payrollService: PayrollService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all payrolls with optional filters' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
    enum: [...PAYROLL_STATUS_VALUES, PAYROLL_STATUS_FILTER_ALL],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of payrolls',
    type: [PayrollDto],
  })
  async findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.payrollService.findAll({
      status,
      branchId: req.user?.branchId || branchId,
      page,
      size,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payroll by ID' })
  @ApiParam({ name: 'id', description: 'Payroll ID' })
  @ApiResponse({
    status: 200,
    description: 'Payroll details',
    type: PayrollDto,
  })
  @ApiResponse({ status: 404, description: 'Payroll not found' })
  async findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new payroll' })
  @ApiResponse({
    status: 201,
    description: 'Payroll created',
    type: PayrollDto,
  })
  async create(@Body() createDto: CreatePayrollDto) {
    const code = await this.payrollService.generateCode();
    const totalSalary = createDto.totalSalary || 0;
    const paid = createDto.paid || 0;
    const remaining = totalSalary - paid;
    const status = createDto.status?.toUpperCase();
    const payload = { ...createDto, code, totalSalary, paid, remaining };
    if (status) {
      payload.status = status;
    }
    return this.payrollService.create(payload, { userId: 'system' } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update payroll' })
  @ApiParam({ name: 'id', description: 'Payroll ID' })
  @ApiResponse({
    status: 200,
    description: 'Payroll updated',
    type: PayrollDto,
  })
  @ApiResponse({ status: 404, description: 'Payroll not found' })
  async update(@Param('id') id: string, @Body() updateDto: UpdatePayrollDto) {
    // Recalculate remaining if totalSalary or paid is updated
    if (updateDto.totalSalary !== undefined || updateDto.paid !== undefined) {
      const existing = await this.payrollService.findOne(id);
      const totalSalary = updateDto.totalSalary ?? existing.totalSalary;
      const paid = updateDto.paid ?? existing.paid;
      updateDto.remaining = totalSalary - paid;
    }
    if (updateDto.status) {
      updateDto.status = updateDto.status.toUpperCase();
    }
    return this.payrollService.update(id, updateDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete payroll' })
  @ApiParam({ name: 'id', description: 'Payroll ID' })
  @ApiResponse({ status: 204, description: 'Payroll deleted' })
  @ApiResponse({ status: 404, description: 'Payroll not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.payrollService.delete(id, { userId: 'system' } as any);
  }
}
