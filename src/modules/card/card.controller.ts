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
import { CardService } from './card.service';
import { CreateCardDto } from './dto/create-card.dto';
import { CardDto } from './dto/card.dto';

@ApiTags('Cards')
@ApiBearerAuth()
@Controller('api/cards')
export class CardController {
  constructor(private cardService: CardService) {}

  @Get()
  @ApiOperation({ summary: 'Get all cards' })
  @ApiResponse({
    status: 200,
    description: 'List of cards',
    type: [CardDto],
  })
  async findAll() {
    return this.cardService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get card by ID' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiResponse({
    status: 200,
    description: 'Card details',
    type: CardDto,
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async findOne(@Param('id') id: string) {
    return this.cardService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new card' })
  @ApiResponse({
    status: 201,
    description: 'Card created',
    type: CardDto,
  })
  async create(@Body() createCardDto: CreateCardDto) {
    return this.cardService.create(createCardDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update card' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiResponse({
    status: 200,
    description: 'Card updated',
    type: CardDto,
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async update(@Param('id') id: string, @Body() createCardDto: CreateCardDto) {
    return this.cardService.update(id, createCardDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete card' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiResponse({ status: 204, description: 'Card deleted' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.cardService.delete(id, { userId: 'system' } as any);
  }
}
