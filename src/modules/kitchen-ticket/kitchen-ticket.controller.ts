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
import { KitchenTicketService } from './kitchen-ticket.service';
import { CreateKitchenTicketDto } from './dto/create-kitchen-ticket.dto';
import { KitchenTicketDto } from './dto/kitchen-ticket.dto';

@ApiTags('Kitchen Tickets')
@ApiBearerAuth()
@Controller('kitchen-tickets')
export class KitchenTicketController {
  constructor(private kitchenTicketService: KitchenTicketService) {}

  @Get()
  @ApiOperation({ summary: 'Get all kitchen tickets' })
  @ApiResponse({
    status: 200,
    description: 'List of kitchen tickets',
    type: [KitchenTicketDto],
  })
  async findAll() {
    return this.kitchenTicketService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get kitchen ticket by ID' })
  @ApiParam({ name: 'id', description: 'Kitchen Ticket ID' })
  @ApiResponse({
    status: 200,
    description: 'Kitchen ticket details',
    type: KitchenTicketDto,
  })
  @ApiResponse({ status: 404, description: 'Kitchen ticket not found' })
  async findOne(@Param('id') id: string) {
    return this.kitchenTicketService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new kitchen ticket' })
  @ApiResponse({
    status: 201,
    description: 'Kitchen ticket created',
    type: KitchenTicketDto,
  })
  async create(@Body() createKitchenTicketDto: CreateKitchenTicketDto) {
    return this.kitchenTicketService.create(createKitchenTicketDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update kitchen ticket' })
  @ApiParam({ name: 'id', description: 'Kitchen Ticket ID' })
  @ApiResponse({
    status: 200,
    description: 'Kitchen ticket updated',
    type: KitchenTicketDto,
  })
  @ApiResponse({ status: 404, description: 'Kitchen ticket not found' })
  async update(
    @Param('id') id: string,
    @Body() createKitchenTicketDto: CreateKitchenTicketDto,
  ) {
    return this.kitchenTicketService.update(id, createKitchenTicketDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete kitchen ticket' })
  @ApiParam({ name: 'id', description: 'Kitchen Ticket ID' })
  @ApiResponse({ status: 204, description: 'Kitchen ticket deleted' })
  @ApiResponse({ status: 404, description: 'Kitchen ticket not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.kitchenTicketService.delete(id, { userId: 'system' } as any);
  }
}
