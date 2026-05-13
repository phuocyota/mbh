import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { CouponService } from './coupon.service';

@Controller('coupons')
export class CouponController {
  constructor(private couponService: CouponService) {}

  @Post()
  async createCoupon(
    @Body()
    createCouponDto: {
      customerId: string;
      reducePrice: number;
      quantity: number;
      expiresAt?: Date;
    },
  ) {
    if (!createCouponDto.customerId || !createCouponDto.reducePrice) {
      throw new BadRequestException('customerId and reducePrice are required');
    }

    return await this.couponService.createCoupon(createCouponDto);
  }

  @Get()
  async getAllCoupons(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return await this.couponService.getAllCoupons(page, limit);
  }

  @Get('customer/:customerId')
  async getCustomerCoupons(@Param('customerId') customerId: string) {
    return await this.couponService.getCustomerCoupons(customerId);
  }

  @Get(':id')
  async getCoupon(@Param('id') couponId: string) {
    return await this.couponService.getCouponById(couponId);
  }

  @Put(':id')
  async updateCoupon(
    @Param('id') couponId: string,
    @Body()
    updateCouponDto: {
      reducePrice?: number;
      quantity?: number;
      status?: string;
      expiresAt?: Date;
    },
  ) {
    return await this.couponService.updateCoupon(couponId, updateCouponDto);
  }

  @Delete(':id')
  async deleteCoupon(@Param('id') couponId: string) {
    return await this.couponService.deleteCoupon(couponId);
  }

  @Post(':id/use/:customerId')
  async useCoupon(
    @Param('id') couponId: string,
    @Param('customerId') customerId: string,
  ) {
    await this.couponService.useCoupon(couponId, customerId);
    return { message: 'Coupon used successfully' };
  }
}
