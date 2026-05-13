import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashMovementService } from './cash-movement.service';
import { CashMovementController } from './cash-movement.controller';
import { CashMovement } from '../../entities/cash-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashMovement])],
  providers: [CashMovementService],
  controllers: [CashMovementController],
  exports: [CashMovementService],
})
export class CashMovementModule {}
