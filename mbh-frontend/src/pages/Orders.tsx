import { useEffect, useState } from 'react';
import { Loader2, Receipt, RefreshCw } from 'lucide-react';
import { api, extractError } from '../lib/api';
import { formatVND, formatDateTime } from '../lib/format';
import { Order } from '../types';

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PAID: 'bg-blue-100 text-blue-700',
  REFUNDED: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    api
      .get('/api/orders', { params })
      .then((r) => setOrders(r.data || []))
      .catch((err) => alert(extractError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openDetail = async (id: string) => {
    try {
      const res = await api.get(`/api/orders/${id}`);
      setSelected(res.data);
    } catch (err) {
      alert(extractError(err));
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Đơn hàng</h1>
        <div className="flex gap-2">
          <select
            className="input max-w-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="PAID">PAID</option>
            <option value="REFUNDED">REFUNDED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="DRAFT">DRAFT</option>
          </select>
          <button onClick={load} className="btn-secondary">
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Mã đơn</th>
              <th className="px-4 py-2">Khách hàng</th>
              <th className="px-4 py-2">Trạng thái</th>
              <th className="px-4 py-2 text-right">Tổng tiền</th>
              <th className="px-4 py-2">Tạo lúc</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-10">
                  <Loader2 className="animate-spin inline" /> Đang tải...
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500">
                  Chưa có đơn hàng
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">{o.orderCode}</td>
                <td className="px-4 py-2">
                  {o.customer?.fullName || '-'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_BADGE[o.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-semibold">
                  {formatVND(o.totalAmount)}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {formatDateTime(o.createdAt)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => openDetail(o.id)}
                    className="text-brand-600 hover:underline text-xs"
                  >
                    Chi tiết
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Receipt size={18} /> {selected.orderCode}
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-gray-500 text-xs">Trạng thái</div>
                  <div className="font-medium">{selected.status}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Thanh toán</div>
                  <div className="font-medium">{selected.paymentStatus}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Khách hàng</div>
                  <div className="font-medium">
                    {selected.customer?.fullName || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Tạo lúc</div>
                  <div className="font-medium">
                    {formatDateTime(selected.createdAt)}
                  </div>
                </div>
              </div>

              <div>
                <div className="font-medium mb-1">Mặt hàng</div>
                <ul className="border rounded-md divide-y">
                  {(selected.items || []).map((it: any) => (
                    <li
                      key={it.id}
                      className="px-3 py-2 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">{it.productName}</div>
                        <div className="text-xs text-gray-500">
                          {it.quantity} × {formatVND(it.unitPrice)}
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatVND(it.totalAmount)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="font-medium mb-1">Thanh toán</div>
                <ul className="border rounded-md divide-y">
                  {(selected.payments || []).map((p: any) => (
                    <li
                      key={p.id}
                      className="px-3 py-2 flex justify-between text-sm"
                    >
                      <span>
                        {p.method} ·{' '}
                        <span className="text-gray-500">{p.status}</span>
                      </span>
                      <span className="font-semibold">
                        {formatVND(p.amount)}
                      </span>
                    </li>
                  ))}
                  {(!selected.payments || selected.payments.length === 0) && (
                    <li className="px-3 py-2 text-gray-500 text-sm">
                      Chưa thanh toán
                    </li>
                  )}
                </ul>
              </div>

              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-gray-600">Tổng cộng</span>
                <span className="text-xl font-bold text-brand-700">
                  {formatVND(selected.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
