import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { safeFormat } from '../utils/scheduler';
import { startOfWeek, isToday, isThisWeek } from 'date-fns';

type Period = 'today' | 'week';

export default function OwnerDashboard() {
  const { activities, customers } = useCustomerStore();
  const [period, setPeriod] = useState<Period>('today');
  const [expandedRep, setExpandedRep] = useState<string | null>(null);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const filtered = useMemo(() =>
    activities.filter(a => {
      const d = new Date(a.date);
      return period === 'today' ? isToday(d) : isThisWeek(d, { weekStartsOn: 1 }) || d >= weekStart;
    }),
  [activities, period, weekStart]);

  // Group by rep
  const byRep = useMemo(() => {
    const map: Record<string, {
      name: string;
      total: number;
      byType: Record<string, number>;
      entries: typeof activities;
    }> = {};
    filtered.forEach(a => {
      if (!map[a.repName]) map[a.repName] = { name: a.repName, total: 0, byType: {}, entries: [] };
      map[a.repName].total++;
      map[a.repName].byType[a.type] = (map[a.repName].byType[a.type] ?? 0) + 1;
      map[a.repName].entries.push(a);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totalLogged = filtered.length;
  const uniqueCustomers = new Set(filtered.map(a => a.customerId)).size;

  const TYPE_LABEL: Record<string, string> = { call: 'calls', visit: 'visits', email: 'emails', note: 'notes' };
  const TYPE_COLOR: Record<string, string> = {
    call: 'text-blue-600', visit: 'text-green-600', email: 'text-red-500', note: 'text-gray-500',
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-2">

      {/* Period toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {(['today', 'week'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {p === 'today' ? 'Today' : 'This Week'}
          </button>
        ))}
      </div>

      {/* Big summary */}
      <div className="bg-[#0F2A4A] rounded-2xl p-6 text-white text-center">
        <p className="text-5xl font-black text-amber-400">{totalLogged}</p>
        <p className="text-base font-bold text-white mt-1">
          {totalLogged === 1 ? 'Activity Logged' : 'Activities Logged'}
        </p>
        <p className="text-sm text-blue-300 mt-1">across {uniqueCustomers} customer{uniqueCustomers !== 1 ? 's' : ''}</p>
        {byRep.length > 0 && (
          <p className="text-xs text-blue-400 mt-1">by {byRep.length} rep{byRep.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Per-rep cards */}
      {byRep.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 font-medium">No activity logged {period === 'today' ? 'today' : 'this week'} yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {byRep.map(rep => {
            const isOpen = expandedRep === rep.name;
            const initials = rep.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={rep.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Rep header row */}
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedRep(isOpen ? null : rep.name)}
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-base">{rep.name}</p>
                    <div className="flex gap-3 mt-0.5 flex-wrap">
                      {Object.entries(rep.byType).map(([type, count]) => (
                        <span key={type} className={`text-xs font-semibold ${TYPE_COLOR[type] ?? 'text-gray-500'}`}>
                          {count} {TYPE_LABEL[type] ?? type}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-3xl font-black text-amber-500">{rep.total}</span>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded: list of customers contacted */}
                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {rep.entries
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(act => {
                        const cust = customers.find(c =>
                          c.id === act.customerId || c.name.toLowerCase() === act.customerId.toLowerCase()
                        );
                        return (
                          <div key={act.id} className="flex items-start gap-3 px-5 py-3">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${
                              act.type === 'call'  ? 'bg-blue-100 text-blue-600' :
                              act.type === 'visit' ? 'bg-green-100 text-green-600' :
                              act.type === 'email' ? 'bg-red-100 text-red-500' :
                                                     'bg-gray-100 text-gray-500'
                            }`}>{act.type}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {cust?.name ?? act.customerId}
                              </p>
                              {act.summary && (
                                <p className="text-xs text-gray-400 truncate mt-0.5">{act.summary.replace(/^\[[^\]]+\]\s*/, '')}</p>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">{safeFormat(act.date, 'h:mm a')}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
