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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierDto } from './dto/supplier.dto';

@ApiTags('Suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SupplierController {
  constructor(private supplierService: SupplierService) {}

  @Get()
  @ApiOperation({ summary: 'Get all suppliers with optional filters' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (active, inactive, all)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by code, name, or phone' })
  @ApiResponse({
    status: 200,
    description: 'List of suppliers',
    type: [SupplierDto],
  })
  async findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.supplierService.findAll({ status, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({
    status: 200,
    description: 'Supplier details',
    type: SupplierDto,
  })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async findOne(@Param('id') id: string) {
    return this.supplierService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new supplier' })
  @ApiResponse({
    status: 201,
    description: 'Supplier created',
    type: SupplierDto,
  })
  async create(@Body() createDto: CreateSupplierDto) {
    const code = await this.supplierService.generateCode();
    return this.supplierService.create(
      { ...createDto, code },
      { userId: 'system' } as any,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update supplier' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({
    status: 200,
    description: 'Supplier updated',
    type: SupplierDto,
  })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(id, updateDto, { userId: 'system' } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete supplier' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({ status: 204, description: 'Supplier deleted' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.supplierService.delete(id, { userId: 'system' } as any);
  }
}
