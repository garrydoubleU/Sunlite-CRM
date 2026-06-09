import { AlertTriangle, Calendar, TrendingUp, Phone, CheckCircle } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { calculateNextVisit, getDaysUntil, getDueDateColor, safeDaysSince, safeFormat } from '../utils/scheduler';
import RoutePlanner from '../components/RoutePlanner';

export default function Dashboard() {
  const { customers, activities } = useCustomerStore();
  const { currentUser } = useAuthStore();
  const role = currentUser?.role ?? 'field_sales';
  const isInsideOrCS = role === 'inside_sales' || role === 'customer_service';

  // ── Shared stats ──────────────────────────────────────────────
  const untouchedCustomers = customers
    .filter(c => c.activeStatus && safeDaysSince(c.lastContactDate) >= 30)
    .sort((a, b) => safeDaysSince(b.lastContactDate) - safeDaysSince(a.lastContactDate));

  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>;
  customers.forEach(c => { tierCounts[c.priorityTier]++; });

  const recentActivities = [...activities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

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

  // ── Inside Sales: call queue = untouched tier 1-2 first, then by days ──
  const callQueue = customers
    .filter(c => c.activeStatus && safeDaysSince(c.lastContactDate) >= 14)
    .sort((a, b) => {
      if (a.priorityTier !== b.priorityTier) return a.priorityTier - b.priorityTier;
      return safeDaysSince(b.lastContactDate) - safeDaysSince(a.lastContactDate);
    })
    .slice(0, 20);

  const calledToday = activities.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    return (a.type === 'call' || a.type === 'note') &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  });

  // ── Render: Inside Sales / Customer Service ───────────────────
  if (isInsideOrCS) {
    return (
      <div className="space-y-5">
        {/* Top stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
              <Phone size={17} className="text-blue-600" />
            </div>
            <p className="text-3xl font-black text-gray-900">{callQueue.length}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">Calls Overdue</p>
            <p className="text-[10px] text-gray-400">14+ days no contact</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center mb-2">
              <CheckCircle size={17} className="text-green-600" />
            </div>
            <p className="text-3xl font-black text-gray-900">{calledToday.length}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">Logged Today</p>
            <p className="text-[10px] text-gray-400">Calls & notes</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center mb-2">
              <AlertTriangle size={17} className="text-red-500" />
            </div>
            <p className="text-3xl font-black text-gray-900">{untouchedCustomers.length}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">Untouched 30d+</p>
            <p className="text-[10px] text-gray-400">Needs attention</p>
          </div>
          <div className="bg-[#0F2A4A] rounded-2xl shadow-sm p-4 text-white">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Tier Breakdown</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([1, 2, 3, 4] as const).map(t => (
                <div key={t} className="bg-white/10 rounded-lg p-1.5 text-center">
                  <p className="text-lg font-black text-white">{tierCounts[t]}</p>
                  <p className="text-[9px] text-white/50">T{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content: call queue + recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Call queue */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Call Queue</h3>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2.5 py-1 rounded-full uppercase">
                Priority order
              </span>
            </div>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {callQueue.map(c => {
                const days = safeDaysSince(c.lastContactDate);
                const tier = c.priorityTier;
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                      tier === 1 ? 'bg-red-100 text-red-600' :
                      tier === 2 ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>T{tier}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{c.name}</p>
                      <p className="text-[10px] text-gray-400">{c.phone || 'No phone'}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      days >= 60 ? 'bg-red-100 text-red-600' :
                      days >= 30 ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{days}d</span>
                  </div>
                );
              })}
              {callQueue.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">All accounts are up to date.</p>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-4">Recent Activity</h3>
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
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
                      <p className="text-xs font-semibold text-gray-700">{customer?.name ?? act.customerId}</p>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{act.summary}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{act.repName} · {safeFormat(act.date, 'MMM d')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Field Sales / Admin ───────────────────────────────
  return (
    <div className="space-y-6">
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
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-amber-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-800">{c.name}</span>
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
                    <p className="text-xs font-semibold text-gray-700">{customer?.name ?? act.customerId}</p>
                    <p className="text-xs text-gray-500 leading-relaxed truncate">{act.summary}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{act.repName} · {safeFormat(act.date, 'MMM d')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
