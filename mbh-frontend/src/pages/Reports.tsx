import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, Package, Trophy } from 'lucide-react';
import { api, extractError } from '../lib/api';
import { formatVND } from '../lib/format';
import { RevenueSummary, DailyRow, TopProduct } from '../types';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());

  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { from, to };
      const [s, d, t, sk] = await Promise.all([
        api
          .get('/api/reports/revenue', { params })
          .then((r) => r.data as RevenueSummary),
        api
          .get('/api/reports/revenue/daily', { params })
          .then((r) => r.data),
        api
          .get('/api/reports/top-products', {
            params: { ...params, limit: 10 },
          })
          .then((r) => r.data as TopProduct[]),
        api.get('/api/reports/stock').then((r) => r.data),
      ]);
      setSummary(s);
      setDaily(d?.data || []);
      setTop(t || []);
      setStock(sk || []);
    } catch (err) {
      alert(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxDailyRevenue = Math.max(1, ...daily.map((d) => d.revenue));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Báo cáo</h1>

      <div className="flex gap-2 mb-4 items-end">
        <div>
          <div className="label">Từ ngày</div>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <div className="label">Đến ngày</div>
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button onClick={load} className="btn-primary">
          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Tải báo cáo'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <TrendingUp size={14} /> Doanh thu thuần
          </div>
          <div className="text-2xl font-bold mt-1 text-brand-700">
            {formatVND(summary?.netRevenue ?? 0)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Tổng đơn</div>
          <div className="text-2xl font-bold mt-1">
            {summary?.orderCount ?? 0}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Hoàn tiền</div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {formatVND(summary?.refundAmount ?? 0)}
          </div>
          <div className="text-xs text-gray-500">
            {summary?.refundCount ?? 0} đơn
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Tổng giảm giá</div>
          <div className="text-2xl font-bold mt-1">
            {formatVND(summary?.totalDiscount ?? 0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily revenue */}
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Doanh thu theo ngày</h3>
          {daily.length === 0 ? (
            <div className="text-center text-gray-500 py-6 text-sm">
              Không có dữ liệu
            </div>
          ) : (
            <ul className="space-y-2">
              {daily.map((d) => (
                <li key={d.day}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{d.day}</span>
                    <span className="font-semibold">
                      {formatVND(d.revenue)}{' '}
                      <span className="text-gray-400 font-normal">
                        ({d.orderCount} đơn)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500"
                      style={{
                        width: `${(d.revenue / maxDailyRevenue) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Payment breakdown */}
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Phương thức thanh toán</h3>
          {!summary || summary.paymentBreakdown.length === 0 ? (
            <div className="text-center text-gray-500 py-6 text-sm">
              Không có dữ liệu
            </div>
          ) : (
            <ul className="space-y-3">
              {summary.paymentBreakdown.map((p) => (
                <li key={p.method} className="flex justify-between">
                  <div>
                    <div className="font-medium">{p.method}</div>
                    <div className="text-xs text-gray-500">
                      {p.count} giao dịch
                    </div>
                  </div>
                  <div className="font-semibold">{formatVND(p.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top products */}
        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" /> Top sản phẩm bán chạy
          </h3>
          {top.length === 0 ? (
            <div className="text-center text-gray-500 py-6 text-sm">
              Không có dữ liệu
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1">#</th>
                  <th className="py-1">Sản phẩm</th>
                  <th className="py-1 text-right">SL</th>
                  <th className="py-1 text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {top.map((p, idx) => (
                  <tr key={p.productId} className="border-t">
                    <td className="py-2">{idx + 1}</td>
                    <td className="py-2">{p.productName}</td>
                    <td className="py-2 text-right">{p.totalQuantity}</td>
                    <td className="py-2 text-right font-semibold">
                      {formatVND(p.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Stock */}
        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Package size={16} /> Tồn kho hiện tại
          </h3>
          {stock.length === 0 ? (
            <div className="text-center text-gray-500 py-6 text-sm">
              Chưa có tồn kho
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1">Nguyên liệu</th>
                  <th className="py-1 text-right">Số lượng</th>
                  <th className="py-1">ĐVT</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((s: any) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 text-right font-semibold">
                      {Number(s.quantity).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2 text-gray-500">{s.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
