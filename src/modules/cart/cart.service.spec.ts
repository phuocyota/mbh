jest.mock('../orders/order.service', () => ({ OrderService: class {} }));
jest.mock('../coupon/coupon.service', () => ({ CouponService: class {} }));
jest.mock('../products/product.service', () => ({ ProductService: class {} }));
jest.mock('../customer/customer.service', () => ({
  CustomerService: class {},
}));

import { CartService } from './cart.service';
import { PAYMENT_METHOD } from '../../common/constant/constant';

describe('CartService authenticated branch', () => {
  const branchId = '44444444-4444-4444-8444-444444444444';
  const oldBranchId = '11111111-1111-4111-8111-111111111111';
  const createContext = (existing = true) => {
    const cart = {
      id: 'cart-id',
      customerId: 'customer-id',
      branchId: oldBranchId,
      totalAmount: 15000,
      items: [
        {
          productId: 'product-id',
          productName: 'Món',
          unitPrice: 15000,
          quantity: 1,
        },
      ],
    };
    const cartRepository = {
      findOne: jest.fn().mockResolvedValue(existing ? cart : null),
      create: jest.fn((value) => ({ id: cart.id, ...value })),
      save: jest.fn(async (value) => value),
    };
    const customerService = {
      findByUserId: jest.fn().mockResolvedValue({ id: cart.customerId }),
    };
    const orderService = {
      createOrder: jest.fn(async (value) => ({ id: 'order-id', ...value })),
      updateStatus: jest.fn().mockResolvedValue({ id: 'order-id', branchId }),
    };
    const service = new CartService(
      cartRepository as any,
      {} as any,
      {} as any,
      customerService as any,
      orderService as any,
      {} as any,
    );
    return { service, cart, cartRepository, customerService, orderService };
  };

  it('creates authenticated carts in the token branch', async () => {
    const c = createContext(false);
    const cart = await c.service.getOrCreateCart(
      undefined,
      undefined,
      branchId,
      'user-id',
    );
    expect(cart.branchId).toBe(branchId);
    expect(c.cartRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ branchId }),
    );
  });

  it('repairs the branch on an existing customer cart', async () => {
    const c = createContext();
    await c.service.getMyCart('user-id', branchId);
    expect(c.cart.branchId).toBe(branchId);
    expect(c.cartRepository.save).toHaveBeenCalledWith(c.cart);
  });

  it('uses the token branch for checkout even when the body and cart specify another branch', async () => {
    const c = createContext();
    jest
      .spyOn(c.service, 'getCart')
      .mockResolvedValue({ ...c.cart, branchId: oldBranchId } as any);
    jest.spyOn(c.service, 'clearCart').mockResolvedValue(undefined);
    await c.service.completeCart(
      'user-id',
      { branchId: oldBranchId, paymentMethod: PAYMENT_METHOD.CASH },
      'STUDENT',
      branchId,
    );
    expect(c.orderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ branchId }),
    );
  });

  it.each([undefined, null, ''])(
    'rejects missing token branch %s before accessing or writing data',
    async (missing) => {
      const c = createContext();
      await expect(
        c.service.completeCart(
          'user-id',
          { branchId: oldBranchId, paymentMethod: PAYMENT_METHOD.CASH },
          'STUDENT',
          missing as any,
        ),
      ).rejects.toThrow('Branch ID is required in authentication token');
      expect(c.customerService.findByUserId).not.toHaveBeenCalled();
      expect(c.cartRepository.save).not.toHaveBeenCalled();
      expect(c.orderService.createOrder).not.toHaveBeenCalled();
    },
  );

  it('preserves anonymous draft cart creation without a token branch', async () => {
    const c = createContext(false);
    await c.service.getOrCreateCart(undefined, 'session-id');
    expect(c.cartRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-id' }),
    );
  });
});

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
