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
import { KitchenTicketItemService } from './kitchen-ticket-item.service';
import { CreateKitchenTicketItemDto } from './dto/create-kitchen-ticket-item.dto';
import { KitchenTicketItemDto } from './dto/kitchen-ticket-item.dto';

@ApiTags('Kitchen Ticket Items')
@ApiBearerAuth()
@Controller('api/kitchen-ticket-items')
export class KitchenTicketItemController {
  constructor(private kitchenTicketItemService: KitchenTicketItemService) {}

  @Get()
  @ApiOperation({ summary: 'Get all kitchen ticket items' })
  @ApiResponse({
    status: 200,
    description: 'List of kitchen ticket items',
    type: [KitchenTicketItemDto],
  })
  async findAll() {
    return this.kitchenTicketItemService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get kitchen ticket item by ID' })
  @ApiParam({ name: 'id', description: 'Kitchen Ticket Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Kitchen ticket item details',
    type: KitchenTicketItemDto,
  })
  @ApiResponse({ status: 404, description: 'Kitchen ticket item not found' })
  async findOne(@Param('id') id: string) {
    return this.kitchenTicketItemService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new kitchen ticket item' })
  @ApiResponse({
    status: 201,
    description: 'Kitchen ticket item created',
    type: KitchenTicketItemDto,
  })
  async create(@Body() createKitchenTicketItemDto: CreateKitchenTicketItemDto) {
    return this.kitchenTicketItemService.create(createKitchenTicketItemDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update kitchen ticket item' })
  @ApiParam({ name: 'id', description: 'Kitchen Ticket Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Kitchen ticket item updated',
    type: KitchenTicketItemDto,
  })
  @ApiResponse({ status: 404, description: 'Kitchen ticket item not found' })
  async update(
    @Param('id') id: string,
    @Body() createKitchenTicketItemDto: CreateKitchenTicketItemDto,
  ) {
    return this.kitchenTicketItemService.update(
      id,
      createKitchenTicketItemDto,
      {
        userId: 'system',
      } as any,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete kitchen ticket item' })
  @ApiParam({ name: 'id', description: 'Kitchen Ticket Item ID' })
  @ApiResponse({ status: 204, description: 'Kitchen ticket item deleted' })
  @ApiResponse({
    status: 404,
    description: 'Kitchen ticket item not found',
  })
  async delete(@Param('id') id: string): Promise<void> {
    await this.kitchenTicketItemService.delete(id, {
      userId: 'system',
    } as any);
  }
}
