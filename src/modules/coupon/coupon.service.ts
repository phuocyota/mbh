import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from 'src/entities';
import { ERROR_MESSAGES } from '../../common/constant/error-messages.constant';
import { COUPON_STATUS } from '../../common/constant/constant';
import { normalizePagination, toPaginationResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
  ) {}

  async createCoupon(createCouponDto: {
    customerId: string;
    reducePrice: number;
    quantity: number;
    expiresAt?: Date;
  }) {
    const coupon = this.couponRepository.create({
      ...createCouponDto,
      status: COUPON_STATUS.ACTIVE,
      usedQuantity: 0,
    });

    return await this.couponRepository.save(coupon);
  }

  async getCouponById(couponId: string) {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException(
        ERROR_MESSAGES.NOT_FOUND_WITH_ID('Coupon', couponId),
      );
    }

    return coupon;
  }

  async getCustomerCoupons(customerId: string, page?: number | string, size?: number | string) {
    const pagination = normalizePagination(page, size);
    const [data, total] = await this.couponRepository.findAndCount({
      where: { customerId, status: COUPON_STATUS.ACTIVE },
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.size,
    });

    return toPaginationResponse(data, total, pagination.page, pagination.size);
  }

  async getBestAvailableCoupon(customerId: string) {
    const now = new Date();
    const coupons = await this.couponRepository.find({
      where: { customerId, status: COUPON_STATUS.ACTIVE },
      order: { reducePrice: 'DESC', createdAt: 'ASC' },
    });

    for (const coupon of coupons) {
      if (coupon.expiresAt && now > coupon.expiresAt) {
        await this.couponRepository.update(coupon.id, {
          status: COUPON_STATUS.EXPIRED,
        });
        continue;
      }

      if (coupon.usedQuantity >= coupon.quantity) {
        await this.couponRepository.update(coupon.id, {
          status: COUPON_STATUS.USED,
        });
        continue;
      }

      return coupon;
    }

    return null;
  }

  async validateAndUseCoupon(couponId: string, customerId: string) {
    const coupon = await this.getCouponById(couponId);

    if (coupon.customerId !== customerId) {
      throw new BadRequestException('Coupon does not belong to this customer');
    }

    if (coupon.status !== COUPON_STATUS.ACTIVE) {
      throw new BadRequestException('Coupon is not active');
    }

    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      await this.couponRepository.update(couponId, {
        status: COUPON_STATUS.EXPIRED,
      });
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.usedQuantity >= coupon.quantity) {
      await this.couponRepository.update(couponId, {
        status: COUPON_STATUS.USED,
      });
      throw new BadRequestException('Coupon has been fully used');
    }

    return coupon;
  }

  async useCoupon(couponId: string, customerId: string) {
    const coupon = await this.validateAndUseCoupon(couponId, customerId);

    const newUsedQuantity = coupon.usedQuantity + 1;
    const isFullyUsed = newUsedQuantity >= coupon.quantity;

    await this.couponRepository.update(couponId, {
      usedQuantity: newUsedQuantity,
      status: isFullyUsed ? COUPON_STATUS.USED : COUPON_STATUS.ACTIVE,
    });

    return coupon;
  }

  async getAllCoupons(page?: number | string, size?: number | string) {
    const pagination = normalizePagination(page, size);
    const [coupons, total] = await this.couponRepository.findAndCount({
      skip: pagination.skip,
      take: pagination.size,
      order: { createdAt: 'DESC' },
    });

    return toPaginationResponse(coupons, total, pagination.page, pagination.size);
  }

  async updateCoupon(
    couponId: string,
    updateCouponDto: {
      reducePrice?: number;
      quantity?: number;
      status?: string;
      expiresAt?: Date;
    },
  ) {
    await this.getCouponById(couponId);

    await this.couponRepository.update(couponId, updateCouponDto);

    return this.getCouponById(couponId);
  }

  async deleteCoupon(couponId: string) {
    const coupon = await this.getCouponById(couponId);
    await this.couponRepository.remove(coupon);
    return { message: 'Coupon deleted successfully' };
  }
}
