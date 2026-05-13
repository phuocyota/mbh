import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  X,
  ChefHat,
  Wallet as WalletIcon,
} from 'lucide-react';
import { api, extractError } from '../lib/api';
import { formatVND } from '../lib/format';
import {
  Stage,
  Product,
  Category,
  CardScanResult,
  CartItem,
  CheckoutResult,
} from '../types';

const IDLE_TIMEOUT_MS = 60_000; // 60s không thao tác → quay về idle
const SUCCESS_TIMEOUT_MS = 8_000; // 8s sau đặt thành công → idle

export default function Kiosk() {
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('branch') || localStorage.getItem('kiosk_branch') || '';
  const posDeviceId =
    searchParams.get('device') || localStorage.getItem('kiosk_device') || '';

  const [stage, setStage] = useState<Stage>('IDLE');
  const [scan, setScan] = useState<CardScanResult | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);

  // Buffer for NFC reader (acts as keyboard)
  const cardBufferRef = useRef('');
  const cardTimerRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  // Save kiosk config to localStorage
  useEffect(() => {
    if (searchParams.get('branch')) {
      localStorage.setItem('kiosk_branch', searchParams.get('branch')!);
    }
    if (searchParams.get('device')) {
      localStorage.setItem('kiosk_device', searchParams.get('device')!);
    }
  }, [searchParams]);

  // Load products + categories once on mount
  useEffect(() => {
    Promise.all([
      api.get('/api/products').then((r) => r.data as Product[]),
      api.get('/api/products/categories').then((r) => r.data as Category[]),
    ])
      .then(([prods, cats]) => {
        setProducts(prods || []);
        setCategories(cats || []);
      })
      .catch((err) => console.error(extractError(err)));
  }, []);

  // Reset to IDLE
  const resetToIdle = () => {
    setScan(null);
    setCart([]);
    setActiveCategory(null);
    setErrorMsg(null);
    setCheckoutResult(null);
    setStage('IDLE');
  };

  // Idle timeout (auto-reset if user idle in MENU/CONFIRM)
  useEffect(() => {
    if (stage === 'MENU' || stage === 'CONFIRM' || stage === 'ERROR') {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(resetToIdle, IDLE_TIMEOUT_MS);
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [stage, cart, activeCategory]);

  // Success → auto-reset
  useEffect(() => {
    if (stage === 'SUCCESS') {
      const t = window.setTimeout(resetToIdle, SUCCESS_TIMEOUT_MS);
      return () => clearTimeout(t);
    }
  }, [stage]);

  // NFC reader = USB HID giả keyboard. Capture chuỗi ký tự liên tiếp + Enter.
  useEffect(() => {
    if (stage !== 'IDLE') return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const uid = cardBufferRef.current.trim();
        cardBufferRef.current = '';
        if (uid.length >= 3) {
          handleCardScan(uid);
        }
        return;
      }
      if (e.key.length === 1) {
        cardBufferRef.current += e.key;
        // reset buffer nếu user gõ chậm (không phải reader)
        if (cardTimerRef.current) clearTimeout(cardTimerRef.current);
        cardTimerRef.current = window.setTimeout(() => {
          cardBufferRef.current = '';
        }, 500);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const handleCardScan = async (uid: string) => {
    if (!branchId || !posDeviceId) {
      setErrorMsg(
        'Kiosk chưa được cấu hình. Liên hệ quản lý (thiếu branchId / posDeviceId).',
      );
      setStage('ERROR');
      return;
    }
    setStage('LOADING');
    setErrorMsg(null);
    try {
      const res = await api.get(`/api/kiosk/card/${encodeURIComponent(uid)}`);
      setScan(res.data);
      setStage('MENU');
    } catch (err) {
      setErrorMsg(extractError(err) || 'Thẻ không hợp lệ');
      setStage('ERROR');
    }
  };

  const filteredProducts = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((p) => p.category?.id === activeCategory);
  }, [products, activeCategory]);

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [cart],
  );

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          unitPrice: Number(p.price),
          quantity: 1,
        },
      ];
    });
  };

  const decrease = (productId: string) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const remove = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const placeOrder = async () => {
    if (!scan || cart.length === 0) return;
    setStage('PROCESSING');
    setErrorMsg(null);
    try {
      const res = await api.post('/api/kiosk/checkout', {
        cardUid: scan.card.cardUid,
        branchId,
        posDeviceId,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });
      setCheckoutResult(res.data);
      setStage('SUCCESS');
    } catch (err) {
      setErrorMsg(extractError(err) || 'Đặt hàng thất bại');
      setStage('ERROR');
    }
  };

  // ─────────────── RENDER ───────────────

  if (stage === 'IDLE') {
    return <IdleScreen branchId={branchId} posDeviceId={posDeviceId} />;
  }

  if (stage === 'LOADING') {
    return (
      <FullScreenCenter>
        <Loader2 className="animate-spin text-white" size={80} />
        <div className="text-white text-3xl mt-6 font-light">Đang xác thực thẻ...</div>
      </FullScreenCenter>
    );
  }

  if (stage === 'PROCESSING') {
    return (
      <FullScreenCenter>
        <Loader2 className="animate-spin text-white" size={80} />
        <div className="text-white text-3xl mt-6 font-light">Đang xử lý đơn hàng...</div>
      </FullScreenCenter>
    );
  }

  if (stage === 'ERROR') {
    return (
      <FullScreenCenter className="bg-gradient-to-br from-red-600 to-red-800">
        <AlertTriangle className="text-white" size={100} />
        <div className="text-white text-4xl mt-6 font-bold">Có lỗi xảy ra</div>
        <div className="text-white/90 text-xl mt-3 max-w-2xl text-center">
          {errorMsg}
        </div>
        <button
          onClick={resetToIdle}
          className="mt-10 bg-white text-red-700 font-bold text-2xl px-10 py-4 rounded-2xl hover:bg-red-50"
        >
          Quay lại
        </button>
      </FullScreenCenter>
    );
  }

  if (stage === 'SUCCESS' && checkoutResult) {
    return (
      <FullScreenCenter className="bg-gradient-to-br from-green-600 to-green-800">
        <CheckCircle2 className="text-white" size={120} />
        <div className="text-white text-5xl mt-6 font-bold">Đặt hàng thành công!</div>
        <div className="text-white/90 text-2xl mt-6">
          Mã đơn: <span className="font-mono font-bold">{checkoutResult.order.orderCode}</span>
        </div>
        <div className="flex items-center gap-3 text-white/90 text-2xl mt-4">
          <ChefHat size={28} /> Vui lòng chờ tại quầy bếp
        </div>
        <div className="mt-8 bg-white/15 rounded-xl px-8 py-4 text-white">
          <div className="text-sm opacity-80">Số dư còn lại</div>
          <div className="text-3xl font-bold">
            {formatVND(checkoutResult.wallet.balanceAfter)}
          </div>
        </div>
        <div className="text-white/70 text-sm mt-10">
          Tự động trở về trong vài giây...
        </div>
      </FullScreenCenter>
    );
  }

  // MENU & CONFIRM share product list + cart sidebar
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Top header */}
      <header className="bg-brand-700 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-sm opacity-80">Xin chào</div>
          <div className="text-2xl font-bold">{scan?.customer.fullName}</div>
          <div className="text-xs opacity-70">
            {scan?.customer.customerCode}
          </div>
        </div>
        <div className="text-right flex items-center gap-3">
          <WalletIcon size={28} />
          <div>
            <div className="text-sm opacity-80">Số dư ví</div>
            <div className="text-3xl font-bold">
              {formatVND(scan?.wallet?.balance ?? 0)}
            </div>
          </div>
        </div>
        <button
          onClick={resetToIdle}
          className="ml-6 bg-white/15 hover:bg-white/25 px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <X size={16} /> Hủy
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Products */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          {/* Category tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <CategoryChip
              active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
            >
              Tất cả
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                active={activeCategory === c.id}
                onClick={() => setActiveCategory(c.id)}
              >
                {c.name}
              </CategoryChip>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="bg-white rounded-2xl p-5 text-left border-2 border-transparent hover:border-brand-500 hover:shadow-lg active:scale-95 transition-all"
                >
                  <div className="aspect-square bg-gradient-to-br from-brand-100 to-brand-200 rounded-xl mb-3 flex items-center justify-center text-5xl">
                    🍔
                  </div>
                  <div className="font-semibold text-base line-clamp-2">{p.name}</div>
                  <div className="text-xl font-bold text-brand-700 mt-2">
                    {formatVND(p.price)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cart */}
        <aside className="w-[420px] bg-white border-l flex flex-col">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-lg">
              <ShoppingBag /> Giỏ hàng ({cart.length})
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-sm text-red-600 hover:underline"
              >
                Xóa hết
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">
                <ShoppingBag size={64} className="mx-auto mb-3 opacity-30" />
                <div>Chưa chọn món nào</div>
                <div className="text-xs mt-2">Bấm vào sản phẩm để thêm</div>
              </div>
            ) : (
              <ul className="space-y-3">
                {cart.map((i) => (
                  <li key={i.productId} className="border rounded-xl p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium">{i.productName}</div>
                      <button
                        onClick={() => remove(i.productId)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <button
                          className="w-9 h-9 rounded-lg border-2 hover:bg-gray-50 active:scale-95 flex items-center justify-center"
                          onClick={() => decrease(i.productId)}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-lg font-semibold w-8 text-center">
                          {i.quantity}
                        </span>
                        <button
                          className="w-9 h-9 rounded-lg border-2 hover:bg-gray-50 active:scale-95 flex items-center justify-center"
                          onClick={() =>
                            addToCart({
                              id: i.productId,
                              name: i.productName,
                              price: i.unitPrice,
                              sku: '',
                            })
                          }
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="font-bold text-brand-700">
                        {formatVND(i.unitPrice * i.quantity)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tổng cộng</span>
              <span className="text-3xl font-bold text-brand-700">
                {formatVND(subtotal)}
              </span>
            </div>
            {scan?.wallet && subtotal > scan.wallet.balance && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                Số dư không đủ. Còn {formatVND(scan.wallet.balance)}
              </div>
            )}
            <button
              onClick={placeOrder}
              disabled={
                cart.length === 0 ||
                !scan?.wallet ||
                subtotal > (scan?.wallet?.balance ?? 0)
              }
              className="w-full bg-brand-600 hover:bg-brand-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl py-4 text-lg font-bold flex items-center justify-center gap-2 transition-all"
            >
              <CreditCard size={20} /> Xác nhận & Thanh toán
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────── Sub-components ───────────

function IdleScreen({
  branchId,
  posDeviceId,
}: {
  branchId: string;
  posDeviceId: string;
}) {
  const configured = !!branchId && !!posDeviceId;
  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
      <div className="text-center px-10">
        <div className="text-7xl mb-6 animate-pulse">💳</div>
        <div className="text-6xl font-bold mb-4">Vui lòng quẹt thẻ</div>
        <div className="text-2xl text-white/80">
          Đặt thẻ học sinh lên đầu đọc để bắt đầu
        </div>
        {!configured && (
          <div className="mt-10 bg-yellow-500/20 border-2 border-yellow-400 text-yellow-100 rounded-xl px-6 py-4 max-w-2xl mx-auto">
            <div className="font-bold text-lg flex items-center justify-center gap-2 mb-2">
              <AlertTriangle /> Kiosk chưa cấu hình
            </div>
            <div className="text-sm">
              Vui lòng truy cập với URL có tham số:{' '}
              <code className="bg-black/30 px-2 py-1 rounded">
                /kiosk?branch=&lt;BRANCH_ID&gt;&amp;device=&lt;POS_DEVICE_ID&gt;
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FullScreenCenter({
  children,
  className = 'bg-gradient-to-br from-brand-700 to-brand-900',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`h-full flex flex-col items-center justify-center ${className}`}>
      {children}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-full font-medium transition-all ${
        active
          ? 'bg-brand-600 text-white shadow-md'
          : 'bg-white border-2 hover:border-brand-300'
      }`}
    >
      {children}
    </button>
  );
}
