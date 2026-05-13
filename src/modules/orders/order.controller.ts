import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('api/orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private orderService: OrderService) {}

  @ApiOperation({ summary: 'Get all orders with optional filtering' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'List of orders' })
  @Get()
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.orderService.findAll(branchId, status);
  }

  @ApiOperation({ summary: 'Get order with items and payments' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order details with items' })
  @Get(':id')
  async getOrderWithItems(@Param('id') id: string) {
    return this.orderService.getOrderWithItems(id);
  }

  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  @Post()
  async createOrder(@Body() createOrderDto: any) {
    return this.orderService.createOrder(createOrderDto);
  }

  @ApiOperation({ summary: 'Add item to order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 201, description: 'Item added to order' })
  @Post(':id/items')
  async addItemToOrder(
    @Param('id') id: string,
    @Body() createOrderItemDto: any,
  ) {
    return this.orderService.addItemToOrder(id, createOrderItemDto);
  }

  @ApiOperation({ summary: 'Process payment for order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Payment processed' })
  @Post(':id/payments')
  async processPayment(@Param('id') id: string, @Body() paymentDto: any) {
    return this.orderService.processPayment(id, paymentDto);
  }

  @ApiOperation({ summary: 'Complete order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order completed' })
  @Put(':id/complete')
  async completeOrder(@Param('id') id: string) {
    return this.orderService.completeOrder(id);
  }

  @ApiOperation({ summary: 'Cancel order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @Put(':id/cancel')
  async cancelOrder(@Param('id') id: string) {
    return this.orderService.cancelOrder(id);
  }
}
