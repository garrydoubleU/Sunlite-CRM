import { type ReactNode, useState } from 'react';
import { LayoutDashboard, Users, MessageSquare, Link2, LogOut, Bell, Search, RefreshCw, Menu, X } from 'lucide-react';
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
  { id: 'activity' as Page, label: 'Activity', icon: MessageSquare },
  { id: 'quicklinks' as Page, label: 'Links', icon: Link2 },
];

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { currentUser, logout } = useAuthStore();
  const { isSyncing, triggerSync } = useCustomerStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* ── Desktop Sidebar (hidden on mobile) ───────────────── */}
      <aside className="hidden md:flex w-60 bg-white flex-col shadow-lg flex-shrink-0">
        <div className="p-6 pb-8">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mb-3">
              <span className="text-amber-500 font-bold text-lg tracking-tight">sunlite</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sunlite</h1>
            <p className="text-xs font-semibold text-amber-500 tracking-[0.2em] uppercase mt-0.5">Field Sales Hub</p>
          </div>
        </div>
        <div className="px-4 mb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Navigation</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = currentPage === id;
            return (
              <button key={id} onClick={() => onNavigate(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-gray-50 shadow-sm text-amber-500 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile slide-out menu overlay ────────────────────── */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileMenu(false)} />
          <div className="relative w-64 bg-white h-full shadow-2xl flex flex-col">
            <div className="p-5 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
                  <span className="text-amber-500 font-bold text-sm">sunlite</span>
                </div>
                <div>
                  <p className="font-black text-gray-900 text-sm">Sunlite</p>
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Field Sales Hub</p>
                </div>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="text-gray-400 p-1">
                <X size={20} />
              </button>
            </div>

            {/* User info */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
                  {currentUser?.avatarInitials}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{currentUser?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{currentUser?.role?.replace('_', ' ')}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                const active = currentPage === id;
                return (
                  <button key={id}
                    onClick={() => { onNavigate(id); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                      active ? 'bg-amber-50 text-amber-600 font-bold' : 'text-gray-600 hover:bg-gray-50'
                    }`}>
                    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-gray-100">
              <button onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all">
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content area ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header className="h-14 md:h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button onClick={() => setShowMobileMenu(true)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-50 -ml-1">
              <Menu size={22} />
            </button>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em]">
              {NAV_ITEMS.find(n => n.id === currentPage)?.label === 'Activity' ? 'Activity Feed'
                : NAV_ITEMS.find(n => n.id === currentPage)?.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search — hidden on small mobile */}
            <div className="hidden sm:flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 w-48 md:w-64">
              <Search size={14} className="text-gray-400" />
              <input placeholder="Search accounts..."
                className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none flex-1 min-w-0" />
            </div>

            {/* Sync */}
            <button onClick={triggerSync}
              className={`p-2 rounded-lg transition-all ${isSyncing ? 'text-amber-500' : 'text-gray-400 hover:bg-gray-50'}`}>
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-50 relative">
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
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {currentUser?.avatarInitials}
            </div>
          </div>
        </header>

        {/* Page content — extra bottom padding on mobile for tab bar */}
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-stretch">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button key={id} onClick={() => onNavigate(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? 'text-amber-500' : 'text-gray-400'
              }`}>
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] font-semibold ${active ? 'text-amber-500' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
