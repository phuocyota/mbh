import { PartialType } from '@nestjs/swagger';
import { CreateCustomerMealItemDto } from './create-customer-meal-item.dto';

export class UpdateCustomerMealItemDto extends PartialType(
  CreateCustomerMealItemDto,
) {}
