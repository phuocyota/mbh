import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem, Product, Customer } from 'src/entities';

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

  async updateItemQuantity(cartItemId: string, quantity: number): Promise<CartItem> {
    const cartItem = await this.cartItemRepository.findOne({ where: { id: cartItemId } });
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

  async removeItem(cartItemId: string): Promise<void> {
    const cartItem = await this.cartItemRepository.findOne({ where: { id: cartItemId } });
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
