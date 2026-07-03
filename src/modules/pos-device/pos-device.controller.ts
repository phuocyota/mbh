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
import { POSDeviceService } from './pos-device.service';
import { CreatePOSDeviceDto } from './dto/create-pos-device.dto';
import { POSDeviceDto } from './dto/pos-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('POS Devices')
@ApiBearerAuth()
@Controller('pos-devices')
export class POSDeviceController {
  constructor(private posDeviceService: POSDeviceService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all POS devices' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of POS devices',
    type: [POSDeviceDto],
  })
  async findAll(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.posDeviceService.findAll(
      page,
      size,
      req.user?.branchId || branchId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get POS device by ID' })
  @ApiParam({ name: 'id', description: 'POS Device ID' })
  @ApiResponse({
    status: 200,
    description: 'POS device details',
    type: POSDeviceDto,
  })
  @ApiResponse({ status: 404, description: 'POS device not found' })
  async findOne(@Param('id') id: string) {
    return this.posDeviceService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new POS device' })
  @ApiResponse({
    status: 201,
    description: 'POS device created',
    type: POSDeviceDto,
  })
  async create(@Body() createPOSDeviceDto: CreatePOSDeviceDto) {
    return this.posDeviceService.create(createPOSDeviceDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update POS device' })
  @ApiParam({ name: 'id', description: 'POS Device ID' })
  @ApiResponse({
    status: 200,
    description: 'POS device updated',
    type: POSDeviceDto,
  })
  @ApiResponse({ status: 404, description: 'POS device not found' })
  async update(
    @Param('id') id: string,
    @Body() createPOSDeviceDto: CreatePOSDeviceDto,
  ) {
    return this.posDeviceService.update(id, createPOSDeviceDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete POS device' })
  @ApiParam({ name: 'id', description: 'POS Device ID' })
  @ApiResponse({ status: 204, description: 'POS device deleted' })
  @ApiResponse({ status: 404, description: 'POS device not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.posDeviceService.delete(id, { userId: 'system' } as any);
  }
}
