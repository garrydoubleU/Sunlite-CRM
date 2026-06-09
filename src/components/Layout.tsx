import { type ReactNode, useState } from 'react';
import { LayoutDashboard, Users, MessageSquare, Link2, LogOut, Bell, Search, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useCustomerStore } from '../store/customerStore';
import NotificationCenter from './NotificationCenter';

type Page = 'dashboard' | 'customers' | 'activity' | 'quicklinks';

interface LayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers' as Page, label: 'Customers', icon: Users },
  { id: 'activity' as Page, label: 'Activity Feed', icon: MessageSquare },
  { id: 'quicklinks' as Page, label: 'Quick Links', icon: Link2 },
];

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { currentUser, logout } = useAuthStore();
  const { isSyncing, triggerSync } = useCustomerStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-white flex flex-col shadow-lg flex-shrink-0">
        {/* Logo */}
        <div className="p-6 pb-8">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mb-3">
              <span className="text-amber-500 font-bold text-lg tracking-tight">sunlite</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sunlite</h1>
            <p className="text-xs font-semibold text-amber-500 tracking-[0.2em] uppercase mt-0.5">Field Sales Hub</p>
          </div>
        </div>

        {/* Nav label */}
        <div className="px-4 mb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Dashboard</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = currentPage === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-white shadow-sm text-amber-500 font-semibold'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
          >
            <LogOut size={18} strokeWidth={2} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em]">
            {NAV_ITEMS.find(n => n.id === currentPage)?.label}
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 w-64">
              <Search size={14} className="text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search accounts or IDs..."
                className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none flex-1"
              />
            </div>

            {/* Sync */}
            <button
              onClick={triggerSync}
              className={`p-2 rounded-lg hover:bg-gray-50 transition-all ${isSyncing ? 'text-amber-500' : 'text-gray-400'}`}
              title="Sync data"
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg hover:bg-gray-50 transition-all text-gray-500 relative"
              >
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">3</span>
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-10 z-50">
                  <NotificationCenter onClose={() => setShowNotifications(false)} />
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{currentUser?.name.split(' ')[0]}</span>
              <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-bold">
                {currentUser?.avatarInitials}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
