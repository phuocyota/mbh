import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  CreditCard,
  Wallet as WalletIcon,
  Banknote,
  Trash2,
  Plus,
  Minus,
  X,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { api, extractError } from '../lib/api';
import { useCart } from '../store/cart';
import { formatVND } from '../lib/format';
import { Product, Branch, POSDevice } from '../types';

export default function POS() {
  const cart = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [devices, setDevices] = useState<POSDevice[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [posDeviceId, setPosDeviceId] = useState<string>('');

  const [cardUid, setCardUid] = useState('');
  const [cardLoading, setCardLoading] = useState(false);
  const [cardMsg, setCardMsg] = useState<string | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'WALLET'>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [paying, setPaying] = useState(false);
  const [lastOrderCode, setLastOrderCode] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    Promise.all([
      api.get('/api/products/categories').then((r) => r.data),
      api.get('/api/products').then((r) => r.data),
      api.get('/api/branches').then((r) => r.data),
      api.get('/api/pos-devices').then((r) => r.data),
    ])
      .then(([cats, prods, br, dev]) => {
        setCategories(cats || []);
        setProducts(prods || []);
        setBranches(br || []);
        setDevices(dev || []);
        if (br?.length) setBranchId(br[0].id);
        if (dev?.length) setPosDeviceId(dev[0].id);
      })
      .catch((err) => console.error(extractError(err)));
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = !activeCategory || p.category?.id === activeCategory;
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, search]);

  const subtotal = cart.subtotal();

  const handleScanCard = async () => {
    if (!cardUid.trim()) return;
    setCardLoading(true);
    setCardMsg(null);
    try {
      const res = await api.get(
        `/api/customers/by-card/${encodeURIComponent(cardUid.trim())}`,
      );
      const { customer, wallet } = res.data;
      cart.setCustomer(
        customer.id,
        customer.fullName,
        wallet ? Number(wallet.balance) : 0,
      );
      setCardMsg(null);
      setCardUid('');
    } catch (err) {
      setCardMsg(extractError(err) || 'Không tìm thấy thẻ');
    } finally {
      setCardLoading(false);
    }
  };

  const openPayment = () => {
    if (cart.items.length === 0) {
      alert('Giỏ hàng trống');
      return;
    }
    if (!branchId || !posDeviceId) {
      alert('Vui lòng chọn chi nhánh và thiết bị POS');
      return;
    }
    setCashReceived('');
    setPaymentMethod(cart.customerId ? 'WALLET' : 'CASH');
    setPaymentOpen(true);
  };

  const submitPayment = async () => {
    if (paying) return;
    setPaying(true);
    try {
      const cashierId =
        JSON.parse(localStorage.getItem('user') || '{}').id || null;

      // 1. Create order
      const orderRes = await api.post('/api/orders', {
        branchId,
        posDeviceId,
        customerId: cart.customerId || undefined,
        cashierId,
        orderType: 'DINE_IN',
      });
      const orderId = orderRes.data.id;

      // 2. Add items
      for (const item of cart.items) {
        const lineSubtotal = item.unitPrice * item.quantity;
        await api.post(`/api/orders/${orderId}/items`, {
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotal: lineSubtotal,
          discountAmount: 0,
          totalAmount: lineSubtotal,
        });
      }

      // 3. Process payment
      const payAmount =
        paymentMethod === 'CASH' ? subtotal : subtotal;
      await api.post(`/api/orders/${orderId}/payments`, {
        method: paymentMethod,
        amount: payAmount,
        customerId: cart.customerId || undefined,
        createdBy: cashierId,
      });

      // 4. Complete
      await api.put(`/api/orders/${orderId}/complete`);

      setLastOrderCode(orderRes.data.orderCode);
      cart.clear();
      setPaymentOpen(false);
    } catch (err) {
      alert(extractError(err) || 'Thanh toán thất bại');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* LEFT: products */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="mb-3 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="input pl-9"
              placeholder="Tìm sản phẩm theo tên hoặc SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input max-w-xs"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">-- Chi nhánh --</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="input max-w-xs"
            value={posDeviceId}
            onChange={(e) => setPosDeviceId(e.target.value)}
          >
            <option value="">-- Thiết bị --</option>
            {devices
              .filter((d) => !branchId || d.branchId === branchId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.deviceName}
                </option>
              ))}
          </select>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 text-sm rounded-full ${
              activeCategory === null
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 text-sm rounded-full ${
                activeCategory === c.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  cart.addProduct({
                    productId: p.id,
                    productName: p.name,
                    unitPrice: Number(p.price),
                  })
                }
                className="card p-4 text-left hover:border-brand-500 hover:shadow-md transition-all"
              >
                <div className="font-medium text-sm line-clamp-2">{p.name}</div>
                <div className="text-xs text-gray-500 mt-1">{p.sku}</div>
                <div className="text-brand-700 font-bold mt-2">
                  {formatVND(p.price)}
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-10">
                Không có sản phẩm
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: cart */}
      <aside className="w-[380px] border-l bg-white flex flex-col">
        <div className="p-4 border-b">
          <div className="text-sm font-medium mb-2">Quẹt thẻ học sinh</div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Nhập / quẹt UID thẻ"
              value={cardUid}
              onChange={(e) => setCardUid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScanCard()}
            />
            <button
              onClick={handleScanCard}
              disabled={cardLoading}
              className="btn-secondary"
            >
              {cardLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                'Quét'
              )}
            </button>
          </div>
          {cardMsg && (
            <div className="text-xs text-red-600 mt-1">{cardMsg}</div>
          )}
          {cart.customerId && (
            <div className="mt-3 bg-brand-50 border border-brand-200 rounded-md p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm">
                    {cart.customerName}
                  </div>
                  <div className="text-xs text-gray-600">
                    Số dư ví: {formatVND(cart.walletBalance ?? 0)}
                  </div>
                </div>
                <button
                  onClick={() => cart.clearCustomer()}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="text-sm font-medium mb-2">
            Giỏ hàng ({cart.items.length})
          </div>
          {cart.items.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-10">
              Chưa có sản phẩm
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.items.map((i) => (
                <li
                  key={i.productId}
                  className="border border-gray-200 rounded-md p-2"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {i.productName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatVND(i.unitPrice)}
                      </div>
                    </div>
                    <button
                      onClick={() => cart.removeProduct(i.productId)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-1">
                      <button
                        className="w-7 h-7 rounded-md border bg-white hover:bg-gray-50 flex items-center justify-center"
                        onClick={() => cart.decreaseProduct(i.productId)}
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={i.quantity}
                        onChange={(e) =>
                          cart.setQuantity(
                            i.productId,
                            Math.max(1, Number(e.target.value) || 1),
                          )
                        }
                        className="w-12 text-center border rounded-md py-1"
                      />
                      <button
                        className="w-7 h-7 rounded-md border bg-white hover:bg-gray-50 flex items-center justify-center"
                        onClick={() =>
                          cart.addProduct({
                            productId: i.productId,
                            productName: i.productName,
                            unitPrice: i.unitPrice,
                          })
                        }
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="font-semibold text-sm">
                      {formatVND(i.unitPrice * i.quantity)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Tổng cộng</span>
            <span className="text-lg font-bold text-brand-700">
              {formatVND(subtotal)}
            </span>
          </div>
          <button
            onClick={openPayment}
            disabled={cart.items.length === 0}
            className="btn-primary w-full text-base"
          >
            <CreditCard size={18} /> Thanh toán
          </button>
        </div>
      </aside>

      {/* Payment Modal */}
      {paymentOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="font-semibold">Thanh toán đơn hàng</h3>
              <button
                onClick={() => setPaymentOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-md p-3 text-center">
                <div className="text-sm text-gray-600">Tổng phải trả</div>
                <div className="text-2xl font-bold text-brand-700">
                  {formatVND(subtotal)}
                </div>
              </div>

              <div>
                <div className="label">Phương thức</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('CASH')}
                    className={`border rounded-md py-3 flex items-center justify-center gap-2 text-sm ${
                      paymentMethod === 'CASH'
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-gray-200'
                    }`}
                  >
                    <Banknote size={16} /> Tiền mặt
                  </button>
                  <button
                    onClick={() => setPaymentMethod('WALLET')}
                    disabled={!cart.customerId}
                    className={`border rounded-md py-3 flex items-center justify-center gap-2 text-sm disabled:opacity-50 ${
                      paymentMethod === 'WALLET'
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-gray-200'
                    }`}
                  >
                    <WalletIcon size={16} /> Ví ({formatVND(
                      cart.walletBalance ?? 0,
                    )})
                  </button>
                </div>
                {paymentMethod === 'WALLET' &&
                  (cart.walletBalance ?? 0) < subtotal && (
                    <div className="mt-2 text-xs text-red-600">
                      Số dư ví không đủ ({formatVND(cart.walletBalance ?? 0)} &lt;{' '}
                      {formatVND(subtotal)})
                    </div>
                  )}
              </div>

              {paymentMethod === 'CASH' && (
                <div>
                  <div className="label">Tiền khách đưa</div>
                  <input
                    type="number"
                    className="input"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={String(subtotal)}
                  />
                  {cashReceived && Number(cashReceived) >= subtotal && (
                    <div className="mt-2 text-sm text-green-700">
                      Tiền thừa:{' '}
                      <strong>
                        {formatVND(Number(cashReceived) - subtotal)}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={submitPayment}
                disabled={
                  paying ||
                  (paymentMethod === 'WALLET' &&
                    (cart.walletBalance ?? 0) < subtotal)
                }
                className="btn-primary w-full"
              >
                {paying && <Loader2 className="animate-spin" size={16} />}
                Xác nhận thanh toán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt success */}
      {lastOrderCode && !paymentOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center">
            <CheckCircle2 className="mx-auto text-green-600 mb-3" size={48} />
            <h3 className="font-semibold text-lg">Thanh toán thành công</h3>
            <div className="text-sm text-gray-600 mt-2">
              Mã đơn:{' '}
              <span className="font-mono font-bold">{lastOrderCode}</span>
            </div>
            <button
              onClick={() => setLastOrderCode(null)}
              className="btn-primary w-full mt-4"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
