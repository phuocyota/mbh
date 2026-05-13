import { Controller, Post, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SeedService } from './seed.service';

@ApiTags('Seed')
@Controller('api/seed')
export class SeedController {
  constructor(private seedService: SeedService) {}

  @ApiOperation({ summary: 'Seed database with test data' })
  @ApiResponse({ status: 200, description: 'Database seeded successfully' })
  @Post('/')
  @HttpCode(200)
  async seed(): Promise<{ message: string }> {
    await this.seedService.seed();
    return { message: 'Database seeded successfully!' };
  }
}
