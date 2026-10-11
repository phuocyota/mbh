jest.mock('./cart.service', () => ({ CartService: class {} }));

import { CartController } from './cart.controller';

describe('CartController token branch forwarding', () => {
  const branchId = '44444444-4444-4444-8444-444444444444';
  const req = { user: { userId: 'user-id', role: 'STUDENT', branchId } };
  const createContext = () => {
    const service = {
      getMyCart: jest.fn(),
      completeCart: jest.fn(),
      getOrCreateCart: jest.fn().mockResolvedValue({ id: 'cart-id' }),
      addItem: jest.fn(),
      getCart: jest.fn(),
      updateItemQuantity: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    };
    return { service, controller: new CartController(service as any) };
  };

  it('forwards the authenticated branch for reading and checkout', async () => {
    const c = createContext();
    const dto = { branchId: '11111111-1111-4111-8111-111111111111' };
    await c.controller.getMyCart(req);
    await c.controller.completeMyCart(req, dto);
    expect(c.service.getMyCart).toHaveBeenCalledWith('user-id', branchId);
    expect(c.service.completeCart).toHaveBeenCalledWith(
      'user-id',
      dto,
      'STUDENT',
      branchId,
    );
  });

  it('forwards the token branch for all authenticated cart mutations', async () => {
    const c = createContext();
    await c.controller.addItemToMyCart(req, {
      productId: 'product-id',
      quantity: 1,
    });
    await c.controller.updateItemQuantity(req, 'item-id', { quantity: 2 });
    await c.controller.removeItem(req, 'item-id');
    await c.controller.clearMyCart(req);
    expect(c.service.getOrCreateCart).toHaveBeenCalledTimes(4);
    for (const call of c.service.getOrCreateCart.mock.calls) {
      expect(call).toEqual([undefined, undefined, branchId, 'user-id']);
    }
  });

  it('rejects checkout without a token branch even if the body supplies one', async () => {
    const c = createContext();
    await expect(
      c.controller.completeMyCart(
        { user: { userId: 'user-id' } },
        { branchId },
      ),
    ).rejects.toThrow('Branch ID is required in authentication token');
    expect(c.service.completeCart).not.toHaveBeenCalled();
  });
});
