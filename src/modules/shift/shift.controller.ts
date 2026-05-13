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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ShiftService } from './shift.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { ShiftDto } from './dto/shift.dto';

@ApiTags('Shifts')
@ApiBearerAuth()
@Controller('api/shifts')
export class ShiftController {
  constructor(private shiftService: ShiftService) {}

  @Get()
  @ApiOperation({ summary: 'Get all shifts' })
  @ApiResponse({
    status: 200,
    description: 'List of shifts',
    type: [ShiftDto],
  })
  async findAll() {
    return this.shiftService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get shift by ID' })
  @ApiParam({ name: 'id', description: 'Shift ID' })
  @ApiResponse({
    status: 200,
    description: 'Shift details',
    type: ShiftDto,
  })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async findOne(@Param('id') id: string) {
    return this.shiftService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new shift' })
  @ApiResponse({
    status: 201,
    description: 'Shift created',
    type: ShiftDto,
  })
  async create(@Body() createShiftDto: CreateShiftDto) {
    return this.shiftService.create(createShiftDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update shift' })
  @ApiParam({ name: 'id', description: 'Shift ID' })
  @ApiResponse({
    status: 200,
    description: 'Shift updated',
    type: ShiftDto,
  })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async update(
    @Param('id') id: string,
    @Body() createShiftDto: CreateShiftDto,
  ) {
    return this.shiftService.update(id, createShiftDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete shift' })
  @ApiParam({ name: 'id', description: 'Shift ID' })
  @ApiResponse({ status: 204, description: 'Shift deleted' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.shiftService.delete(id, { userId: 'system' } as any);
  }
}
