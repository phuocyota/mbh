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
import { RefundItemService } from './refund-item.service';
import { CreateRefundItemDto } from './dto/create-refund-item.dto';
import { RefundItemDto } from './dto/refund-item.dto';

@ApiTags('Refund Items')
@ApiBearerAuth()
@Controller('api/refund-items')
export class RefundItemController {
  constructor(private refundItemService: RefundItemService) {}

  @Get()
  @ApiOperation({ summary: 'Get all refund items' })
  @ApiResponse({
    status: 200,
    description: 'List of refund items',
    type: [RefundItemDto],
  })
  async findAll() {
    return this.refundItemService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get refund item by ID' })
  @ApiParam({ name: 'id', description: 'Refund Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Refund item details',
    type: RefundItemDto,
  })
  @ApiResponse({ status: 404, description: 'Refund item not found' })
  async findOne(@Param('id') id: string) {
    return this.refundItemService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new refund item' })
  @ApiResponse({
    status: 201,
    description: 'Refund item created',
    type: RefundItemDto,
  })
  async create(@Body() createRefundItemDto: CreateRefundItemDto) {
    return this.refundItemService.create(createRefundItemDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update refund item' })
  @ApiParam({ name: 'id', description: 'Refund Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Refund item updated',
    type: RefundItemDto,
  })
  @ApiResponse({ status: 404, description: 'Refund item not found' })
  async update(
    @Param('id') id: string,
    @Body() createRefundItemDto: CreateRefundItemDto,
  ) {
    return this.refundItemService.update(id, createRefundItemDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete refund item' })
  @ApiParam({ name: 'id', description: 'Refund Item ID' })
  @ApiResponse({ status: 204, description: 'Refund item deleted' })
  @ApiResponse({ status: 404, description: 'Refund item not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.refundItemService.delete(id, { userId: 'system' } as any);
  }
}
