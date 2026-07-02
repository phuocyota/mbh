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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of suppliers',
    type: [SupplierDto],
  })
  async findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.supplierService.findAll({ status, search, page, size });
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
    const mappedData = {
      ...createDto,
      province: createDto.city || createDto.province,
      idCard: createDto.cccd || createDto.idCard,
      companyName: createDto.company || createDto.companyName,
      code,
    };
    
    // Clean up FE specific fields to avoid TypeORM mismatch or other issues
    delete (mappedData as any).city;
    delete (mappedData as any).cccd;
    delete (mappedData as any).company;

    return this.supplierService.create(
      mappedData,
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
    const mappedData = {
      ...updateDto,
    };
    if ((updateDto as any).city !== undefined) {
      (mappedData as any).province = (updateDto as any).city;
      delete (mappedData as any).city;
    }
    if ((updateDto as any).cccd !== undefined) {
      (mappedData as any).idCard = (updateDto as any).cccd;
      delete (mappedData as any).cccd;
    }
    if ((updateDto as any).company !== undefined) {
      (mappedData as any).companyName = (updateDto as any).company;
      delete (mappedData as any).company;
    }

    return this.supplierService.update(id, mappedData, { userId: 'system' } as any);
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

  @Get(':id/debts')
  @ApiOperation({ summary: 'Get supplier debt history' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({ status: 200, description: 'Supplier debt history' })
  async getDebts(@Param('id') id: string) {
    return this.supplierService.getDebts(id);
  }
}
