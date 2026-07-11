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
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerDto } from './dto/customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomerController {
  constructor(private customerService: CustomerService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all customers' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({
    name: 'getDebt',
    required: false,
    type: Boolean,
    description:
      'Include the current customer debt derived from wallet balance',
  })
  @ApiResponse({
    status: 200,
    description: 'List of customers',
    type: [CustomerDto],
  })
  async findAll(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('getDebt') getDebt?: string,
  ) {
    return this.customerService.findAll(
      page,
      size,
      req.user?.branchId || branchId,
      getDebt === 'true',
    );
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Tìm khách hàng theo tên / mã / số điện thoại',
  })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async search(
    @Req() req: any,
    @Query('keyword') keyword: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customerService.searchCustomers(
      keyword,
      page,
      size ?? limit,
      req.user?.branchId || branchId,
    );
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
