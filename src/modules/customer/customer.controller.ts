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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerDto } from './dto/customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('api/customers')
export class CustomerController {
  constructor(private customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  @ApiResponse({
    status: 200,
    description: 'List of customers',
    type: [CustomerDto],
  })
  async findAll() {
    return this.customerService.findAll();
  }

  @Get('search')
  @ApiOperation({
    summary: 'Tìm khách hàng theo tên / mã / số điện thoại',
  })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async search(
    @Query('keyword') keyword: string,
    @Query('limit') limit?: number,
  ) {
    return this.customerService.searchCustomers(keyword, limit);
  }

  @Get('by-card/:cardUid')
  @ApiOperation({
    summary: 'Tìm customer theo UID thẻ NFC/RFID',
    description: 'Trả về customer + thông tin card + số dư ví (nếu có).',
  })
  @ApiParam({ name: 'cardUid', description: 'Card UID (NFC/RFID)' })
  @ApiResponse({ status: 200, description: 'Customer + wallet info' })
  @ApiResponse({ status: 404, description: 'Card hoặc customer không tồn tại' })
  async findByCardUid(@Param('cardUid') cardUid: string) {
    return this.customerService.findByCardUid(cardUid);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: 200,
    description: 'Customer details',
    type: CustomerDto,
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new customer' })
  @ApiResponse({
    status: 201,
    description: 'Customer created',
    type: CustomerDto,
  })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.create(createCustomerDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: 200,
    description: 'Customer updated',
    type: CustomerDto,
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async update(
    @Param('id') id: string,
    @Body() createCustomerDto: CreateCustomerDto,
  ) {
    return this.customerService.update(id, createCustomerDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ status: 204, description: 'Customer deleted' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.customerService.delete(id, { userId: 'system' } as any);
  }
}
