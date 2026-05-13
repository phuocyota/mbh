import { FormEvent, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogIn, Loader2 } from 'lucide-react';
import { api, extractError } from '../lib/api';
import { useAuth } from '../store/auth';

export default function Login() {
  const token = useAuth((s) => s.token);
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@pos.local');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (token) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { access_token, user } = res.data;
      setAuth(user, access_token);
      navigate('/');
    } catch (err) {
      setError(extractError(err) || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 p-4">
      <div className="w-full max-w-md card p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand-700">MBH POS</h1>
          <p className="text-sm text-gray-600 mt-1">
            Đăng nhập vào hệ thống bán hàng
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Mật khẩu</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <LogIn size={16} />
            )}
            Đăng nhập
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-500 border-t pt-4">
          <p className="font-medium mb-1">Tài khoản test (sau khi seed):</p>
          <ul className="space-y-0.5">
            <li>admin@pos.local / admin123</li>
            <li>cashier1@pos.local / cashier123</li>
            <li>kitchen1@pos.local / kitchen123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
