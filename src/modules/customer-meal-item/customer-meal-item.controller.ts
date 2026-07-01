import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CustomerMealItemService } from './customer-meal-item.service';
import { CustomerMealItemDto } from './dto/customer-meal-item.dto';
import { CustomerMealItemQueryDto } from './dto/customer-meal-item-query.dto';
import { CreateCustomerMealItemDto } from './dto/create-customer-meal-item.dto';
import { UpdateCustomerMealItemDto } from './dto/update-customer-meal-item.dto';

@ApiTags('Customer Meal Items')
@ApiBearerAuth()
@Controller('customer-meal-items')
export class CustomerMealItemController {
  constructor(private customerMealItemService: CustomerMealItemService) {}

  @Get()
  @ApiOperation({ summary: 'Get customer meal items' })
  @ApiResponse({
    status: 200,
    description: 'List of customer meal items',
    type: [CustomerMealItemDto],
  })
  async findAll(@Query() query: CustomerMealItemQueryDto) {
    return this.customerMealItemService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer meal item by ID' })
  @ApiParam({ name: 'id', description: 'Customer meal item ID' })
  @ApiResponse({
    status: 200,
    description: 'Customer meal item details',
    type: CustomerMealItemDto,
  })
  async findOne(@Param('id') id: string) {
    return this.customerMealItemService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create customer meal item' })
  @ApiResponse({
    status: 201,
    description: 'Customer meal item created',
    type: CustomerMealItemDto,
  })
  async create(@Body() dto: CreateCustomerMealItemDto) {
    return this.customerMealItemService.createCustomerMealItem(dto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer meal item' })
  @ApiParam({ name: 'id', description: 'Customer meal item ID' })
  @ApiResponse({
    status: 200,
    description: 'Customer meal item updated',
    type: CustomerMealItemDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerMealItemDto,
  ) {
    return this.customerMealItemService.updateCustomerMealItem(id, dto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete customer meal item' })
  @ApiParam({ name: 'id', description: 'Customer meal item ID' })
  @ApiResponse({ status: 204, description: 'Customer meal item deleted' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.customerMealItemService.delete(id, { userId: 'system' } as any);
  }
}
