import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import {
  User,
  Branch,
  POSDevice,
  Customer,
  Card,
  Wallet,
  Category,
  Product,
  StudentProfile,
  School,
  Class,
  StudentClass,
} from '../../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Branch,
      POSDevice,
      Customer,
      Card,
      Wallet,
      Category,
      Product,
      StudentProfile,
      School,
      Class,
      StudentClass,
    ]),
  ],
  providers: [SeedService],
  controllers: [SeedController],
  exports: [SeedService],
})
export class SeedModule {}
