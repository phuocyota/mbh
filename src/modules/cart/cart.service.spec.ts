jest.mock('../orders/order.service', () => ({ OrderService: class {} }));
jest.mock('../coupon/coupon.service', () => ({ CouponService: class {} }));
jest.mock('../products/product.service', () => ({ ProductService: class {} }));
jest.mock('../customer/customer.service', () => ({
  CustomerService: class {},
}));

import { CartService } from './cart.service';

describe('CartService item updates', () => {
  const createContext = (initialNote = 'Ghi chú cũ') => {
    const cartItem = {
      id: '22222222-2222-4222-8222-222222222222',
      cartId: '11111111-1111-4111-8111-111111111111',
      unitPrice: 15000,
      quantity: 1,
      subtotal: 15000,
      note: initialNote,
    };
    const cartRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const cartItemRepository = {
      findOne: jest.fn().mockResolvedValue(cartItem),
      find: jest.fn().mockResolvedValue([cartItem]),
      save: jest.fn(async (value) => value),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CartService(
      cartRepository as any,
      cartItemRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, cartItem, cartItemRepository, cartRepository };
  };

  it('updates quantity and note together', async () => {
    const context = createContext();

    const result = await context.service.updateItemQuantity(
      context.cartItem.cartId,
      context.cartItem.id,
      2,
      'Không cay',
    );

    expect(result.quantity).toBe(2);
    expect(result.subtotal).toBe(30000);
    expect(result.note).toBe('Không cay');
    expect(context.cartItemRepository.save).toHaveBeenCalledWith(
      context.cartItem,
    );
    expect(context.cartRepository.update).toHaveBeenCalledWith(
      context.cartItem.cartId,
      {
        totalAmount: 30000,
        itemCount: 2,
      },
    );
  });

  it('keeps the existing note when note is omitted', async () => {
    const context = createContext();

    await context.service.updateItemQuantity(
      context.cartItem.cartId,
      context.cartItem.id,
      3,
    );

    expect(context.cartItem.note).toBe('Ghi chú cũ');
  });

  it('clears the note when an empty string is provided', async () => {
    const context = createContext();

    await context.service.updateItemQuantity(
      context.cartItem.cartId,
      context.cartItem.id,
      1,
      '',
    );

    expect(context.cartItem.note).toBe('');
  });
});
