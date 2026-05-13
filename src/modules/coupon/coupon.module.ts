import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from 'src/entities';
import { CouponService } from './coupon.service';
import { CouponController } from './coupon.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon])],
  providers: [CouponService],
  controllers: [CouponController],
  exports: [CouponService],
})
export class CouponModule {}
