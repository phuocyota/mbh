import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ShoppingCart,
  ClipboardList,
  Users,
  BarChart2,
  LogOut,
  Bell,
  HelpCircle,
  Settings,
  User,
} from 'lucide-react';
import { useAuth } from '../store/auth';

const navItems = [
  { to: '/', label: 'Tổng quan' },
  { to: '/pos', label: 'Bán hàng' },
  { to: '/orders', label: 'Đơn hàng' },
  { to: '/customers', label: 'Khách hàng' },
  { to: '/reports', label: 'Báo cáo' },
];

export default function Layout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Navigation - KiotViet Style */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-md sticky top-0 z-40">
        <div className="px-6 py-2.5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 min-w-[140px]">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">M</span>
              </div>
              <span className="text-lg font-bold text-blue-600">MBH</span>
            </div>
          </div>

          {/* Main navigation */}
          <nav className="hidden md:flex items-center gap-1 flex-1 mx-6">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/20 text-white shadow-sm'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-white/90 hover:bg-white/10 rounded-lg transition-all text-sm font-medium flex items-center gap-2">
              <Bell size={18} />
              <span className="hidden lg:inline">Thư ngân</span>
            </button>
            
            <button className="p-2 text-white/90 hover:bg-white/10 rounded-lg transition-all">
              <Bell size={18} />
            </button>
            
            <button className="p-2 text-white/90 hover:bg-white/10 rounded-lg transition-all">
              <HelpCircle size={18} />
            </button>
            
            <button className="p-2 text-white/90 hover:bg-white/10 rounded-lg transition-all">
              <Settings size={18} />
            </button>

            {/* User menu */}
            <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/20">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">
                  {user?.fullName || 'User'}
                </p>
                <p className="text-xs text-white/70">{user?.role || 'Staff'}</p>
              </div>
              <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all">
                <User size={18} className="text-white" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                title="Đăng xuất"
              >
                <LogOut size={18} className="text-white/90 hover:text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
