import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart, CartItem } from 'src/entities';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { OrderModule } from '../orders/order.module';
import { CouponModule } from '../coupon/coupon.module';
import { ProductModule } from '../products/product.module';
import { CustomerModule } from '../customer/customer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem]),
    OrderModule,
    CouponModule,
    ProductModule,
    CustomerModule,
  ],
  providers: [CartService],
  controllers: [CartController],
  exports: [CartService],
})
export class CartModule {}
