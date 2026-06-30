import { PartialType } from '@nestjs/swagger';
import { CreateMealItemDto } from './create-meal-item.dto';

export class UpdateMealItemDto extends PartialType(CreateMealItemDto) {}
