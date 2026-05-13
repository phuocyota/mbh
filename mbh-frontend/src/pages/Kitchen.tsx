import { useEffect, useState, useCallback } from 'react';
import { ChefHat, Loader2, RefreshCw, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { api, extractError } from '../lib/api';
import { formatDateTime } from '../lib/format';

interface KitchenTicketItem {
  id: string;
  productName: string;
  quantity: number;
  status: string;
}

interface KitchenTicket {
  id: string;
  orderId: string;
  branchId: string;
  status: string;
  createdAt: string;
  items: KitchenTicketItem[];
  order?: { orderCode: string };
}

const STATUS_COLORS: Record<string, string> = {
  WAITING: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  PREPARING: 'bg-blue-100 border-blue-300 text-blue-800',
  READY: 'bg-green-100 border-green-300 text-green-800',
  DELIVERED: 'bg-gray-100 border-gray-300 text-gray-600',
  CANCELLED: 'bg-red-100 border-red-300 text-red-800',
};

const STATUS_LABEL: Record<string, string> = {
  WAITING: 'Chờ chế biến',
  PREPARING: 'Đang chế biến',
  READY: 'Sẵn sàng',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

export default function Kitchen() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/api/kitchen-tickets')
      .then((r) => setTickets(r.data || []))
      .catch((err) => console.error(extractError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  const updateTicketStatus = async (id: string, status: string) => {
    try {
      await api.put(`/api/kitchen-tickets/${id}`, { status });
      load();
    } catch (err) {
      alert(extractError(err));
    }
  };

  const activeTickets = tickets.filter(
    (t) => t.status !== 'DELIVERED' && t.status !== 'CANCELLED',
  );
  const waitingTickets = activeTickets.filter((t) => t.status === 'WAITING');
  const preparingTickets = activeTickets.filter((t) => t.status === 'PREPARING');
  const readyTickets = activeTickets.filter((t) => t.status === 'READY');

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      WAITING: 'PREPARING',
      PREPARING: 'READY',
      READY: 'DELIVERED',
    };
    return flow[current] || null;
  };

  const getNextLabel = (current: string): string => {
    const labels: Record<string, string> = {
      WAITING: 'Bắt đầu chế biến',
      PREPARING: 'Đánh dấu sẵn sàng',
      READY: 'Đã giao hàng',
    };
    return labels[current] || '';
  };

  const getTimeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút`;
    return `${Math.floor(mins / 60)} giờ`;
  };

  const renderTicketCard = (ticket: KitchenTicket) => {
    const next = getNextStatus(ticket.status);
    const doneCount = ticket.items.filter((i) => i.status === 'DONE').length;

    return (
      <div
        key={ticket.id}
        className={`rounded-xl border-2 p-4 ${STATUS_COLORS[ticket.status] || 'bg-gray-100 border-gray-300'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-bold text-lg">
              {ticket.order?.orderCode || ticket.id.slice(0, 8)}
            </span>
            <span className="ml-2 text-xs opacity-70">
              {getTimeAgo(ticket.createdAt)}
            </span>
          </div>
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-white/60">
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>

        <ul className="space-y-1.5 mb-3">
          {ticket.items.map((item) => (
            <li
              key={item.id}
              className={`flex items-center justify-between px-2 py-1 rounded text-sm ${
                item.status === 'DONE' ? 'line-through opacity-50' : ''
              }`}
            >
              <span className="flex items-center gap-1.5">
                {item.status === 'DONE' && <CheckCircle2 size={14} className="text-green-600" />}
                <span className="font-medium">{item.productName}</span>
              </span>
              <span className="font-bold">x{item.quantity}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between text-xs">
          <span className="opacity-70">
            {doneCount}/{ticket.items.length} món xong
          </span>
          {next && (
            <button
              onClick={() => updateTicketStatus(ticket.id, next)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg font-semibold shadow-sm hover:shadow transition-all"
            >
              {getNextLabel(ticket.status)}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }