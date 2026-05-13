import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Put,
  Delete,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CancelOrderDto } from './dto/cancel-order.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
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

  @ApiOperation({ summary: 'Get orders waiting for cash payment' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({ status: 200, description: 'List of cash payment pending orders' })
  @Get('pending-cash')
  async findPendingCash(@Query('branchId') branchId?: string) {
    return this.orderService.findPendingCashOrders(branchId);
  }

  @ApiOperation({ summary: 'Get orders currently preparing' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({ status: 200, description: 'List of preparing orders' })
  @Get('preparing')
  async findPreparing(@Query('branchId') branchId?: string) {
    return this.orderService.findPreparingOrders(branchId);
  }

  @ApiOperation({ summary: 'Get orders ready for pickup' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({ status: 200, description: 'List of ready-to-pickup orders' })
  @Get('ready-to-pickup')
  async findReadyToPickup(@Query('branchId') branchId?: string) {
    return this.orderService.findReadyToPickupOrders(branchId);
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

  @ApiOperation({ summary: 'Receive cash payment from customer (PENDING_PAYMENT -> READY_TO_PICKUP)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Cash payment received, order status updated to ready-to-pickup' })
  @Post(':id/receive-cash')
  async receiveCashPayment(@Param('id') id: string, @Body() paymentDto: any, @Req() req: any) {
    const userId = req.user?.userId;
    return this.orderService.receiveCashPayment(id, {
      amount: paymentDto.amount,
      createdBy: userId,
    });
  }

  // FE Actions APIs

  @ApiOperation({ summary: 'Set order status to pending' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order status set to pending' })
  @Put(':id/pending')
  async setPending(@Param('id') id: string) {
    return this.orderService.updateStatus(id, 'Pending');
  }

  @ApiOperation({ summary: 'Set order status to ready for pickup' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order status set to ready for pickup' })
  @Put(':id/ready-to-pickup')
  async setReadyToPickup(@Param('id') id: string) {
    return this.orderService.updateStatus(id, 'READY_TO_PICKUP');
  }

  @ApiOperation({ summary: 'Set order status to done (complete)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order completed' })
  @Put(':id/done')
  async setDone(@Param('id') id: string) {
    return this.orderService.completeOrder(id);
  }

  @ApiOperation({ summary: 'Student confirms they received their order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order marked as received by student' })
  @Put('me/:id/received')
  async confirmMyReceived(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.userId;
    return this.orderService.confirmReceivedByCustomer(id, userId);
  }

  @ApiOperation({ summary: 'Cashier confirms customer received order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order marked as received by cashier' })
  @Put(':id/received')
  async confirmReceivedByCashier(@Param('id') id: string) {
    return this.orderService.confirmReceivedByCashier(id);
  }

  @ApiOperation({ summary: 'Cancel order with refund info' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: CancelOrderDto })
  @ApiResponse({ status: 200, description: 'Order cancelled with refund info' })
  @Put(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orderService.cancelOrder(id, dto);
  }

  @ApiOperation({ summary: 'Remove/delete order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order removed' })
  @Delete(':id')
  async removeOrder(@Param('id') id: string) {
    return this.orderService.deleteOrder(id);
  }
}
