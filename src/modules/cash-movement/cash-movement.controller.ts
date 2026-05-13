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
import { CashMovementService } from './cash-movement.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { CashMovementDto } from './dto/cash-movement.dto';

@ApiTags('Cash Movements')
@ApiBearerAuth()
@Controller('cash-movements')
export class CashMovementController {
  constructor(private cashMovementService: CashMovementService) {}

  @Get()
  @ApiOperation({ summary: 'Get all cash movements' })
  @ApiResponse({
    status: 200,
    description: 'List of cash movements',
    type: [CashMovementDto],
  })
  async findAll() {
    return this.cashMovementService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cash movement by ID' })
  @ApiParam({ name: 'id', description: 'Cash Movement ID' })
  @ApiResponse({
    status: 200,
    description: 'Cash movement details',
    type: CashMovementDto,
  })
  @ApiResponse({ status: 404, description: 'Cash movement not found' })
  async findOne(@Param('id') id: string) {
    return this.cashMovementService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new cash movement' })
  @ApiResponse({
    status: 201,
    description: 'Cash movement created',
    type: CashMovementDto,
  })
  async create(@Body() createCashMovementDto: CreateCashMovementDto) {
    return this.cashMovementService.create(createCashMovementDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update cash movement' })
  @ApiParam({ name: 'id', description: 'Cash Movement ID' })
  @ApiResponse({
    status: 200,
    description: 'Cash movement updated',
    type: CashMovementDto,
  })
  @ApiResponse({ status: 404, description: 'Cash movement not found' })
  async update(
    @Param('id') id: string,
    @Body() createCashMovementDto: CreateCashMovementDto,
  ) {
    return this.cashMovementService.update(id, createCashMovementDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete cash movement' })
  @ApiParam({ name: 'id', description: 'Cash Movement ID' })
  @ApiResponse({ status: 204, description: 'Cash movement deleted' })
  @ApiResponse({ status: 404, description: 'Cash movement not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.cashMovementService.delete(id, { userId: 'system' } as any);
  }
}
