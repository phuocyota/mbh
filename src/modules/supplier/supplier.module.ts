import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier, Debt } from '../../entities';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, Debt])],
  providers: [SupplierService],
  controllers: [SupplierController],
  exports: [SupplierService],
})
export class SupplierModule {}

