import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';

@Injectable()
export class OrderNumberService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  /**
   * Generate next order number by finding the smallest missing number
   * If no numbers are missing, returns the max number + 1
   * Example: If orders have numbers [1, 2, 3, 5, 6], it returns 4
   * If orders have numbers [1, 2, 3], it returns 4
   */
  async generateNextOrderNumber(): Promise<number> {
    // Get all existing order numbers sorted
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.orderNumber', 'orderNumber')
      .where('order.orderNumber IS NOT NULL')
      .orderBy('order.orderNumber', 'ASC')
      .getRawMany();

    const existingNumbers = orders
      .map((o) => parseInt(o.orderNumber, 10))
      .filter((num) => !isNaN(num))
      .sort((a, b) => a - b);

    if (existingNumbers.length === 0) {
      return 1;
    }

    // Find the first missing number (fill holes)
    for (let i = 1; i <= existingNumbers.length; i++) {
      if (!existingNumbers.includes(i)) {
        return i;
      }
    }

    // If no holes, return max + 1
    return Math.max(...existingNumbers) + 1;
  }
}
