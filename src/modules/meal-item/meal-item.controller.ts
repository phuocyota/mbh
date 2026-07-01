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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MealItemService } from './meal-item.service';
import { CreateMealItemDto } from './dto/create-meal-item.dto';
import { UpdateMealItemDto } from './dto/update-meal-item.dto';
import { MealItemQueryDto } from './dto/meal-item-query.dto';
import { MealItemDto } from './dto/meal-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Meal Items')
@ApiBearerAuth()
@Controller('meal-items')
@UseGuards(JwtAuthGuard)
export class MealItemController {
  constructor(private mealItemService: MealItemService) {}

  @Get()
  @ApiOperation({ summary: 'Get meal items' })
  @ApiResponse({
    status: 200,
    description: 'List of meal items',
    type: [MealItemDto],
  })
  async findAll(@Query() query: MealItemQueryDto, @Req() req: any) {
    return this.mealItemService.findAllForUser(query, req.user?.userId);
  }

  @Get('week-plan')
  @ApiOperation({ summary: 'Get meal items grouped as a weekly plan' })
  async weekPlan(@Query() query: MealItemQueryDto, @Req() req: any) {
    return this.mealItemService.getWeekPlan(query, req.user?.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get meal item by ID' })
  @ApiParam({ name: 'id', description: 'Meal item ID' })
  @ApiResponse({
    status: 200,
    description: 'Meal item details',
    type: MealItemDto,
  })
  @ApiResponse({ status: 404, description: 'Meal item not found' })
  async findOne(@Param('id') id: string) {
    return this.mealItemService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create meal item' })
  @ApiResponse({
    status: 201,
    description: 'Meal item created',
    type: MealItemDto,
  })
  async create(@Body() createMealItemDto: CreateMealItemDto) {
    return this.mealItemService.createMealItem(createMealItemDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update meal item' })
  @ApiParam({ name: 'id', description: 'Meal item ID' })
  @ApiResponse({
    status: 200,
    description: 'Meal item updated',
    type: MealItemDto,
  })
  @ApiResponse({ status: 404, description: 'Meal item not found' })
  async update(
    @Param('id') id: string,
    @Body() updateMealItemDto: UpdateMealItemDto,
  ) {
    return this.mealItemService.updateMealItem(id, updateMealItemDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete meal item' })
  @ApiParam({ name: 'id', description: 'Meal item ID' })
  @ApiResponse({ status: 204, description: 'Meal item deleted' })
  @ApiResponse({ status: 404, description: 'Meal item not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.mealItemService.delete(id, { userId: 'system' } as any);
  }
}
