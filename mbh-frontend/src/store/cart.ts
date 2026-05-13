import { create } from 'zustand';

export interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
  customerName: string | null;
  walletBalance: number | null;
  addProduct: (p: {
    productId: string;
    productName: string;
    unitPrice: number;
  }) => void;
  decreaseProduct: (productId: string) => void;
  removeProduct: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setCustomer: (
    customerId: string | null,
    customerName: string | null,
    walletBalance: number | null,
  ) => void;
  clearCustomer: () => void;
  clear: () => void;
  subtotal: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  customerId: null,
  customerName: null,
  walletBalance: null,

  addProduct: (p) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === p.productId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === p.productId
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId: p.productId,
            productName: p.productName,
            unitPrice: p.unitPrice,
            quantity: 1,
          },
        ],
      };
    }),

  decreaseProduct: (productId) =>
    set((state) => ({
      items: state.items
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i,
        )
        .filter((i) => i.quantity > 0),
    })),

  removeProduct: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    })),

  setQuantity: (productId, quantity) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0),
    })),

  setCustomer: (customerId, customerName, walletBalance) =>
    set({ customerId, customerName, walletBalance }),

  clearCustomer: () =>
    set({ customerId: null, customerName: null, walletBalance: null }),

  clear: () =>
    set({
      items: [],
      customerId: null,
      customerName: null,
      walletBalance: null,
    }),

  subtotal: () => {
    return get().items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0,
    );
  },
}));
