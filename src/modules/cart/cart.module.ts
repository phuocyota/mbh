import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart, CartItem, Product, Customer } from 'src/entities';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { OrderModule } from '../orders/order.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, Product, Customer]), OrderModule],
  providers: [CartService],
  controllers: [CartController],
  exports: [CartService],
})
export class CartModule {}
