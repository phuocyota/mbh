import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { POSDeviceService } from './pos-device.service';
import { POSDeviceController } from './pos-device.controller';
import { POSDevice } from '../../entities/pos-device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([POSDevice])],
  providers: [POSDeviceService],
  controllers: [POSDeviceController],
  exports: [POSDeviceService],
})
export class POSDeviceModule {}
