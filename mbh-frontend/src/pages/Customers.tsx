import { useEffect, useState } from 'react';
import { Search, Wallet, Loader2, Plus, History } from 'lucide-react';
import { api, extractError } from '../lib/api';
import { formatVND, formatDateTime } from '../lib/format';
import { Customer, WalletInfo, WalletTx } from '../types';

export default function Customers() {
  const [keyword, setKeyword] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);

  const [topupAmount, setTopupAmount] = useState('');
  const [topupNote, setTopupNote] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/customers/search', {
        params: { keyword },
      });
      setCustomers(res.data || []);
    } catch (err) {
      alert(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCustomer = async (c: Customer) => {
    setSelected(c);
    setWallet(null);
    setTransactions([]);
    setMsg(null);
    try {
      const [w, tx] = await Promise.all([
        api.get(`/api/wallets/customer/${c.id}/balance`).then((r) => r.data),
        api
          .get(`/api/wallets/customer/${c.id}/transactions`, {
            params: { size: 30 },
          })
          .then((r) => r.data),
      ]);
      setWallet(w);
      setTransactions(tx?.data || []);
    } catch (err) {
      alert(extractError(err));
    }
  };

  const submitTopup = async () => {
    if (!selected) return;
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) {
      setMsg('Nhập số tiền hợp lệ');
      return;
    }
    setTopupLoading(true);
    setMsg(null);
    try {
      await api.post('/api/wallets/topup', {
        customerId: selected.id,
        amount,
        note: topupNote || undefined,
      });
      setTopupAmount('');
      setTopupNote('');
      setMsg('Nạp tiền thành công');
      await openCustomer(selected); // refresh
    } catch (err) {
      setMsg(extractError(err));
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Khách hàng</h1>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className="input pl-9"
            placeholder="Tìm theo tên / mã / SĐT"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
        </div>
        <button onClick={search} className="btn-primary">
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          Tìm
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Mã</th>
                <th className="px-3 py-2">Tên</th>
                <th className="px-3 py-2">Loại</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500 py-6">
                    Không có khách hàng
                  </td>
                </tr>
              )}
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className={`border-t hover:bg-gray-50 cursor-pointer ${
                    selected?.id === c.id ? 'bg-brand-50' : ''
                  }`}
                  onClick={() => openCustomer(c)}
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {c.customerCode}
                  </td>
                  <td className="px-3 py-2">{c.fullName}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{c.type}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-brand-600 text-xs">Xem ví →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail */}
        <div className="card p-4">
          {!selected && (
            <div className="text-gray-500 text-sm text-center py-10">
              Chọn 1 khách hàng để xem ví
            </div>
          )}
          {selected && (
            <>
              <div className="border-b pb-3 mb-3">
                <div className="text-lg font-semibold">{selected.fullName}</div>
                <div className="text-sm text-gray-600">
                  Mã: <span className="font-mono">{selected.customerCode}</span>
                  {selected.phone && ` · ${selected.phone}`}
                </div>
              </div>

              <div className="bg-gradient-to-br from-brand-600 to-brand-800 text-white rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <Wallet size={16} /> Số dư ví
                </div>
                <div className="text-3xl font-bold mt-1">
                  {wallet ? formatVND(wallet.balance) : '...'}
                </div>
                <div className="text-xs opacity-75 mt-1">
                  Trạng thái: {wallet?.status || '-'}
                </div>
              </div>

              <div className="border rounded-md p-3 mb-3">
                <div className="font-medium mb-2 flex items-center gap-2">
                  <Plus size={16} /> Nạp tiền vào ví
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    className="input"
                    placeholder="Số tiền"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Ghi chú (tùy chọn)"
                    value={topupNote}
                    onChange={(e) => setTopupNote(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[50000, 100000, 200000, 500000].map((q) => (
                    <button
                      key={q}
                      onClick={() => setTopupAmount(String(q))}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      +{formatVND(q)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={submitTopup}
                  disabled={topupLoading}
                  className="btn-primary w-full mt-3"
                >
                  {topupLoading && (
                    <Loader2 className="animate-spin" size={16} />
                  )}
                  Nạp tiền
                </button>
                {msg && (
                  <div
                    className={`text-xs mt-2 ${
                      msg.includes('thành công')
                        ? 'text-green-700'
                        : 'text-red-600'
                    }`}
                  >
                    {msg}
                  </div>
                )}
              </div>

              <div>
                <div className="font-medium mb-2 flex items-center gap-2 text-sm">
                  <History size={14} /> Lịch sử ví ({transactions.length})
                </div>
                <div className="max-h-72 overflow-auto border rounded-md">
                  {transactions.length === 0 ? (
                    <div className="text-center text-gray-500 py-4 text-sm">
                      Chưa có giao dịch
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {transactions.map((t) => (
                        <li key={t.id} className="px-3 py-2 text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">
                                {t.type === 'TOPUP'
                                  ? 'Nạp tiền'
                                  : t.type === 'PAYMENT'
                                    ? 'Thanh toán'
                                    : t.type === 'REFUND'
                                      ? 'Hoàn tiền'
                                      : t.type}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDateTime(t.createdAt)}
                                {t.note && ` · ${t.note}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-semibold ${
                                  ['TOPUP', 'REFUND'].includes(t.type)
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {['TOPUP', 'REFUND'].includes(t.type)
                                  ? '+'
                                  : '-'}
                                {formatVND(t.amount)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Còn: {formatVND(t.balanceAfter)}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
