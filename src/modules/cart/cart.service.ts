import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem, Product, Customer } from 'src/entities';
import { OrderService } from '../orders/order.service';
import { CompleteCartDto } from './dto/complete-cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private orderService: OrderService,
  ) {}

  async getOrCreateCart(customerId?: string, sessionId?: string, branchId?: string, userId?: string): Promise<Cart> {
    let cart: Cart | null = null;
    let resolvedCustomerId = customerId;

    // If userId provided, find customer by userId
    if (userId && !customerId) {
      const customer = await this.customerRepository.findOne({
        where: { userId },
      });
      if (customer) {
        resolvedCustomerId = customer.id;
      }
    }

    if (resolvedCustomerId) {
      cart = await this.cartRepository.findOne({
        where: { customerId: resolvedCustomerId },
        relations: ['items', 'items.product'],
      });
    } else if (sessionId) {
      cart = await this.cartRepository.findOne({
        where: { sessionId },
        relations: ['items', 'items.product'],
      });
    }

    if (!cart) {
      cart = this.cartRepository.create({
        customerId: resolvedCustomerId,
        sessionId,
        branchId,
        totalAmount: 0,
        itemCount: 0,
      });
      await this.cartRepository.save(cart);
    }

    return cart;
  }

  async addItem(
    cartId: string,
    productId: string,
    quantity: number,
    note?: string,
  ): Promise<CartItem> {
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
      relations: ['items'],
    });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (!product.isActive) {
      throw new BadRequestException(`Product ${product.name} is not available`);
    }

    // Check if item already exists in cart
    let cartItem = await this.cartItemRepository.findOne({
      where: { cartId, productId },
    });

    if (cartItem) {
      cartItem.quantity += quantity;
      cartItem.subtotal = cartItem.quantity * cartItem.unitPrice;
      await this.cartItemRepository.save(cartItem);
    } else {
      cartItem = this.cartItemRepository.create({
        cartId,
        productId,
        productName: product.name,
        unitPrice: product.price,
        quantity,
        subtotal: product.price * quantity,
        note,
      });
      await this.cartItemRepository.save(cartItem);
    }

    await this.recalculateCartTotals(cartId);

    return cartItem;
  }

  async updateItemQuantity(cartId: string, cartItemId: string, quantity: number): Promise<CartItem> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { id: cartItemId, cartId },
    });
    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (quantity <= 0) {
      await this.cartItemRepository.remove(cartItem);
    } else {
      cartItem.quantity = quantity;
      cartItem.subtotal = cartItem.unitPrice * quantity;
      await this.cartItemRepository.save(cartItem);
    }

    await this.recalculateCartTotals(cartItem.cartId);

    return cartItem;
  }

  async removeItem(cartId: string, cartItemId: string): Promise<void> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { id: cartItemId, cartId },
    });
    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemRepository.remove(cartItem);
    await this.recalculateCartTotals(cartItem.cartId);
  }

  async clearCart(cartId: string): Promise<void> {
    const cart = await this.cartRepository.findOne({ where: { id: cartId } });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    await this.cartItemRepository.delete({ cartId });

    cart.totalAmount = 0;
    cart.itemCount = 0;
    await this.cartRepository.save(cart);
  }

  async completeCart(userId: string, dto: CompleteCartDto) {
    if (!userId) {
      throw new BadRequestException('User is required');
    }

    const cart = await this.getOrCreateCart(undefined, undefined, undefined, userId);
    const cartWithItems = await this.getCart(cart.id);

    if (!cartWithItems.items?.length) {
      throw new BadRequestException('Cart is empty');
    }

    const totalAmount = Number(cartWithItems.totalAmount);
    const paymentMethod = dto.paymentMethod ?? 'WALLET';

    const order = await this.orderService.createOrder({
      branchId: dto.branchId ?? cartWithItems.branchId,
      posDeviceId: dto.posDeviceId,
      customerId: cartWithItems.customerId,
      cashierId: userId,
      orderType: dto.orderType ?? 'TAKEAWAY',
      note: dto.note,
      items: cartWithItems.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        discountAmount: 0,
      })),
    });
    if (!order) {
      throw new BadRequestException('Could not create order from cart');
    }

    if (paymentMethod === 'CASH') {
      const waitingOrder = await this.orderService.updateStatus(order.id, 'PENDING_PAYMENT');
      await this.clearCart(cartWithItems.id);

      return {
        order: waitingOrder,
        payment: null,
        nextAction: 'WAITING_FOR_CASHIER_PAYMENT',
      };
    }

    const payment = await this.orderService.processPayment(order.id, {
      method: paymentMethod,
      amount: totalAmount,
      customerId: cartWithItems.customerId,
      createdBy: userId,
    });

    const completedOrder = await this.orderService.completeOrder(order.id);
    await this.clearCart(cartWithItems.id);

    return {
      order: completedOrder,
      payment,
    };
  }

  async getCart(cartId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
      relations: ['items', 'items.product'],
    });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    return cart;
  }

  private async recalculateCartTotals(cartId: string): Promise<void> {
    const items = await this.cartItemRepository.find({ where: { cartId } });
    const totalAmount = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    await this.cartRepository.update(cartId, {
      totalAmount,
      itemCount,
    });
  }
}
