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
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeeController {
  constructor(private employeeService: EmployeeService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nhân viên, lọc theo trạng thái' })
  @ApiQuery({ name: 'status', required: false, enum: ['working', 'quit'], description: 'Lọc theo trạng thái' })
  @ApiResponse({ status: 200, description: 'Danh sách nhân viên' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  async findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.employeeService.findAll(
      status,
      req.user?.branchId || branchId,
      page,
      size,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin nhân viên theo ID' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Thông tin nhân viên' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân viên' })
  async findOne(@Param('id') id: string) {
    return this.employeeService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo nhân viên mới' })
  @ApiResponse({ status: 201, description: 'Tạo nhân viên thành công' })
  async create(@Body() dto: CreateEmployeeDto) {
    return this.employeeService.create(dto, { userId: 'system' } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin nhân viên' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân viên' })
  async update(@Param('id') id: string, @Body() dto: CreateEmployeeDto) {
    return this.employeeService.update(id, dto, { userId: 'system' } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa nhân viên' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 204, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân viên' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.employeeService.delete(id, { userId: 'system' } as any);
  }
}
