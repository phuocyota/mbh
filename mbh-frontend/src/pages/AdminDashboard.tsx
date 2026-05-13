import { useEffect, useState } from 'react';
import {
  TrendingUp,
  Package,
  AlertCircle,
  DollarSign,
  ShoppingCart,
  Calendar,
} from 'lucide-react';
import { api, extractError } from '../lib/api';
import { formatVND, formatDate } from '../lib/format';
import { DashboardData } from '../types';

const defaultData: DashboardData = {
  revenue: { total: 0, today: 0, trend: 0 },
  orders: { total: 0, processing: 0, completed: 0 },
  inventory: { total: 0, lowStock: 0 },
  topProducts: [],
  recentOrders: [],
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');

        // Gọi các API song song
        const [revenueRes, ordersRes, inventoryRes, productsRes] =
          await Promise.all([
            api.get('/api/reports/revenue', {
              params: {
                from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0],
                to: new Date().toISOString().split('T')[0],
              },
            }),
            api.get('/api/orders'),
            api.get('/api/reports/stock'),
            api.get('/api/reports/top-products', {
              params: {
                from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0],
                to: new Date().toISOString().split('T')[0],
                limit: 5,
              },
            }),
          ]);

        setData({
          revenue: {
            total: revenueRes.data?.total || 0,
            today: revenueRes.data?.today || 0,
            trend: revenueRes.data?.trend || 0,
          },
          orders: {
            total: ordersRes.data?.length || 0,
            processing: ordersRes.data?.filter(
              (o: any) => o.status === 'pending',
            ).length || 0,
            completed:
              ordersRes.data?.filter((o: any) => o.status === 'completed')
                .length || 0,
          },
          inventory: {
            total: inventoryRes.data?.total || 0,
            lowStock: inventoryRes.data?.lowStock || 0,
          },
          topProducts: productsRes.data || [],
          recentOrders: (ordersRes.data || []).slice(0, 5),
        });
      } catch (err) {
        setError(extractError(err));
        setData(defaultData);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900">
            Bức tranh kinh doanh
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Tổng quan hoạt động kinh doanh của bạn
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-8 p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 shadow-sm">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Lỗi tải dữ liệu</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Key metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Revenue */}
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg p-7 transition-all duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Doanh thu thuần hôm nay</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {formatVND(data.revenue.today)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Không phát sinh doanh thu
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-100 to-blue-50 p-4 rounded-full">
                <DollarSign className="text-blue-600" size={28} />
              </div>
            </div>
          </div>

          {/* Total orders */}
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg p-7 transition-all duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Số lượng đơn hôm nay</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {data.orders.total}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Không phát sinh đơn
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-100 to-green-50 p-4 rounded-full">
                <ShoppingCart className="text-green-600" size={28} />
              </div>
            </div>
          </div>

          {/* Inventory status */}
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg p-7 transition-all duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Tỉ lệ phù bán</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">0%</p>
                <p className="text-xs text-gray-500 mt-2">0/1 bàn đang sử dụng</p>
              </div>
              <div className="bg-gradient-to-br from-orange-100 to-orange-50 p-4 rounded-full">
                <Package className="text-orange-600" size={28} />
              </div>
            </div>
          </div>

          {/* Low stock warning */}
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg p-7 transition-all duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Giao món siêu tốc</p>
                <p className="text-lg font-bold text-gray-900 mt-2">
                  Grab, Ahamove, Xanh SM
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Xem chi tiết
                </p>
              </div>
              <div className="bg-gradient-to-br from-red-100 to-red-50 p-4 rounded-full">
                <TrendingUp className="text-red-600" size={28} />
              </div>
            </div>
          </div>
        </div>

        {/* Charts and tables */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-md p-7 border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Doanh thu thuần
              </h2>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white hover:border-gray-400">
                <option>7 ngày qua</option>
                <option>30 ngày</option>
                <option>Tháng này</option>
              </select>
            </div>

            {/* Placeholder chart */}
            <div className="h-64 flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-dashed border-gray-300">
              <div className="text-center">
                <TrendingUp
                  className="mx-auto mb-2 text-gray-400"
                  size={40}
                />
                <p className="text-gray-500 font-medium">Biểu đồ doanh thu</p>
              </div>
            </div>
          </div>

          {/* Top products */}
          <div className="bg-white rounded-2xl shadow-md p-7 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">
              Top sản phẩm bán chạy
            </h2>

            {data.topProducts.length === 0 ? (
              <div className="text-center py-10">
                <Package className="mx-auto mb-3 text-gray-400" size={40} />
                <p className="text-gray-500 text-sm">
                  Chưa có dữ liệu sản phẩm bán chạy
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.topProducts.map((product, idx) => (
                  <div key={idx} className="flex justify-between items-start pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Đã bán: {product.sold}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-blue-600">
                      {formatVND(product.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="mt-10 bg-white rounded-2xl shadow-md p-7 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Đơn hàng gần đây
            </h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Xem tất cả
            </button>
          </div>

          {data.recentOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto mb-3 text-gray-400" size={40} />
              <p className="text-gray-500 text-sm">Chưa có đơn hàng</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Mã đơn
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Giờ
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Trạng thái
                    </th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700">
                      Tổng tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 text-gray-900 font-semibold">
                        {order.orderId}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {formatDate(new Date(order.createdAt))}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            order.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {order.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-gray-900 font-bold">
                        {formatVND(order.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
