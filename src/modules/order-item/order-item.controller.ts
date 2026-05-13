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
import { OrderItemService } from './order-item.service';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { OrderItemDto } from './dto/order-item.dto';

@ApiTags('Order Items')
@ApiBearerAuth()
@Controller('order-items')
export class OrderItemController {
  constructor(private orderItemService: OrderItemService) {}

  @Get()
  @ApiOperation({ summary: 'Get all order items' })
  @ApiResponse({
    status: 200,
    description: 'List of order items',
    type: [OrderItemDto],
  })
  async findAll() {
    return this.orderItemService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order item by ID' })
  @ApiParam({ name: 'id', description: 'Order Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Order item details',
    type: OrderItemDto,
  })
  @ApiResponse({ status: 404, description: 'Order item not found' })
  async findOne(@Param('id') id: string) {
    return this.orderItemService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new order item' })
  @ApiResponse({
    status: 201,
    description: 'Order item created',
    type: OrderItemDto,
  })
  async create(@Body() createOrderItemDto: CreateOrderItemDto) {
    return this.orderItemService.create(createOrderItemDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update order item' })
  @ApiParam({ name: 'id', description: 'Order Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Order item updated',
    type: OrderItemDto,
  })
  @ApiResponse({ status: 404, description: 'Order item not found' })
  async update(
    @Param('id') id: string,
    @Body() createOrderItemDto: CreateOrderItemDto,
  ) {
    return this.orderItemService.update(id, createOrderItemDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete order item' })
  @ApiParam({ name: 'id', description: 'Order Item ID' })
  @ApiResponse({ status: 204, description: 'Order item deleted' })
  @ApiResponse({ status: 404, description: 'Order item not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.orderItemService.delete(id, { userId: 'system' } as any);
  }
}
