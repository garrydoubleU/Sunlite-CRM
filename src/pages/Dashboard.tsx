import { useState } from 'react';
import { AlertTriangle, Calendar, TrendingUp, Clock } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { calculateNextVisit, getDaysUntil, getDueDateColor, safeDaysSince, safeFormat } from '../utils/scheduler';
import RoutePlanner from '../components/RoutePlanner';
import CustomerModal from '../components/CustomerModal';
import AssignmentAlert from '../components/AssignmentAlert';
import CallerDashboard from './CallerDashboard';
import AdminDashboard from './AdminDashboard';
import OwnerDashboard from './OwnerDashboard';
import type { Customer } from '../types';

export default function Dashboard() {
  const { customers, activities } = useCustomerStore();
  const { currentUser } = useAuthStore();
  const role = currentUser?.role ?? 'field_sales';
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  function openCustomer(nameOrId: string) {
    const found = customers.find(c =>
      c.id === nameOrId || c.name.toLowerCase() === nameOrId.toLowerCase()
    );
    if (found) setSelectedCustomer(found);
  }
  if (role === 'owner') return <OwnerDashboard />;
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'inside_sales' || role === 'customer_service') return <CallerDashboard />;

  // ── Shared stats ──────────────────────────────────────────────
  const untouchedCustomers = customers
    .filter(c => c.activeStatus && safeDaysSince(c.lastContactDate) >= 30)
    .sort((a, b) => safeDaysSince(b.lastContactDate) - safeDaysSince(a.lastContactDate));

  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>;
  customers.forEach(c => { tierCounts[c.priorityTier]++; });

  const recentActivities = [...activities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  // Activities that have a future follow-up date set
  const now = new Date();
  const upcomingFollowUps = activities
    .filter(a => a.followUpDate && new Date(a.followUpDate) >= now)
    .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())
    .slice(0, 10);

  // ── Field / Admin stats ───────────────────────────────────────
  const followUpsToday = customers.filter(c => {
    if (!c.activeStatus) return false;
    return getDaysUntil(calculateNextVisit(c.lastContactDate, c.visitFrequency, c.dayOfWeek)) <= 0;
  });

  const routeEntries = customers
    .filter(c => c.activeStatus)
    .map(c => ({ customer: c, nextVisit: calculateNextVisit(c.lastContactDate, c.visitFrequency, c.dayOfWeek) }))
    .filter(r => getDaysUntil(r.nextVisit) >= -1 && getDaysUntil(r.nextVisit) <= 14)
    .sort((a, b) => a.nextVisit.getTime() - b.nextVisit.getTime())
    .slice(0, 6);


  // ── Render: Field Sales / Admin ───────────────────────────────
  return (
    <div className="space-y-6">
      <AssignmentAlert />
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <span className="text-[10px] font-bold bg-red-500 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">High Priority</span>
          </div>
          <p className="text-4xl font-black text-gray-900">{untouchedCustomers.length}</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Untouched L1–L4s</p>
          <p className="text-xs text-gray-400 mt-1">No activity in 30+ days</p>
          {untouchedCustomers.length > 0 && (
            <div className="mt-3 space-y-1">
              {untouchedCustomers.slice(0, 3).map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 truncate">{c.name}</span>
                  <span className="text-red-500 font-semibold ml-2 flex-shrink-0">{safeDaysSince(c.lastContactDate)}d</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Calendar size={20} className="text-amber-600" />
            </div>
            <span className="text-[10px] font-bold bg-amber-500 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">Today</span>
          </div>
          <p className="text-4xl font-black text-gray-900">{followUpsToday.length}</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Visits Due Today</p>
          <p className="text-xs text-gray-400 mt-1">Customers due for a field visit</p>
          {followUpsToday.length > 0 && (
            <div className="mt-3 space-y-1">
              {followUpsToday.slice(0, 3).map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${c.priorityTier === 1 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                    T{c.priorityTier}
                  </div>
                  <span className="text-gray-600 truncate">{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0F2A4A] rounded-2xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-amber-400" />
            </div>
            <span className="text-[10px] font-bold bg-amber-500 text-white px-2.5 py-1 rounded-full uppercase tracking-wide">Weekly</span>
          </div>
          <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Portfolio Tier Health</p>
          <div className="grid grid-cols-2 gap-2">
            {([1, 2, 3, 4] as const).map(tier => (
              <div key={tier} className="bg-white/10 rounded-xl p-3">
                <p className="text-2xl font-black text-white">{tierCounts[tier]}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wide">Tier {tier}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <RoutePlanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Upcoming Routed Accounts</h3>
          <div className="space-y-2">
            {routeEntries.map(({ customer: c, nextVisit }) => {
              const days = getDaysUntil(nextVisit);
              const colorClass = getDueDateColor(nextVisit);
              const label = days <= 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : safeFormat(nextVisit.toISOString(), 'EEE, MMM d');
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-amber-50 transition-colors cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-amber-600 hover:underline">{c.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                        c.visitFrequency === 'weekly' ? 'bg-blue-100 text-blue-600' :
                        c.visitFrequency === 'biweekly' ? 'bg-purple-100 text-purple-600' :
                        'bg-green-100 text-green-600'
                      }`}>{c.visitFrequency}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{c.id}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${colorClass}`}>{label}</span>
                </div>
              );
            })}
            {routeEntries.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">No visits scheduled in the next 14 days.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivities.map(act => {
              const customer = customers.find(c =>
                c.id === act.customerId ||
                c.name.toLowerCase() === act.customerId.toLowerCase()
              );
              const colors: Record<string, string> = {
                call: 'bg-blue-100 text-blue-600',
                visit: 'bg-green-100 text-green-600',
                note: 'bg-gray-100 text-gray-600',
                email: 'bg-red-100 text-red-500',
              };
              return (
                <div key={act.id} className="flex gap-3">
                  <span className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase self-start flex-shrink-0 ${colors[act.type]}`}>
                    {act.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => openCustomer(act.customerId)} className="text-xs font-semibold text-amber-600 hover:underline text-left truncate block w-full">
                      {customer?.name ?? act.customerId}
                    </button>
                    <p className="text-xs text-gray-500 leading-relaxed truncate">{act.summary}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{act.repName} · {safeFormat(act.date, 'MMM d')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upcoming follow-ups */}
      {upcomingFollowUps.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-amber-500" />
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Upcoming Follow-ups</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {upcomingFollowUps.map(act => {
              const customer = customers.find(c =>
                c.id === act.customerId || c.name.toLowerCase() === act.customerId.toLowerCase()
              );
              const daysUntil = Math.ceil((new Date(act.followUpDate!).getTime() - now.getTime()) / 86400000);
              return (
                <div key={act.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <button onClick={() => openCustomer(act.customerId)} className="text-xs font-bold text-amber-700 hover:underline text-left truncate block">
                      {customer?.name ?? act.customerId}
                    </button>
                    <p className="text-[10px] text-gray-500 truncate">{act.summary}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    daysUntil === 0 ? 'bg-red-100 text-red-600' :
                    daysUntil <= 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `IN ${daysUntil}D`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}
