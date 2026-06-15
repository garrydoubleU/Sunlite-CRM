import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Settings2, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { safeFormat } from '../utils/scheduler';
import { startOfWeek, isToday, isThisWeek, format } from 'date-fns';

const TYPE_LABEL: Record<string, string> = { call: 'calls', visit: 'visits', email: 'emails', note: 'notes' };
const TYPE_COLOR: Record<string, string> = {
  call: 'text-blue-600', visit: 'text-green-600', email: 'text-red-500', note: 'text-gray-500',
};
const BAR_COLORS: Record<string, string> = {
  calls: '#2563EB', visits: '#16A34A', emails: '#EF4444', notes: '#9CA3AF',
};

type RepStat = { byType: Record<string, number>; total: number };
const emptyStat = (): RepStat => ({ byType: {}, total: 0 });

export default function OwnerDashboard() {
  const { activities, customers } = useCustomerStore();
  const { currentUser } = useAuthStore();
  const { ownerDashboardReps, setOwnerDashboardReps } = useSettingsStore();

  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [chartView, setChartView] = useState<'today' | 'week'>('today');

  const firstName = currentUser?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const inWeek = (d: Date) => isThisWeek(d, { weekStartsOn: 1 }) || d >= weekStart;

  // All rep names that logged anything this week — used for the filter panel
  const allRepNames = useMemo(() => {
    const names = new Set<string>();
    activities.forEach(a => {
      const d = new Date(a.date);
      if (isToday(d) || inWeek(d)) names.add(a.repName);
    });
    return Array.from(names).sort();
  }, [activities, weekStart]);

  // Per-rep stats — filtered by admin visibility setting
  const reps = useMemo(() => {
    const map: Record<string, {
      name: string;
      today: RepStat;
      week: RepStat;
      todayEntries: typeof activities;
    }> = {};
    activities.forEach(a => {
      const d = new Date(a.date);
      const isT = isToday(d);
      const isW = inWeek(d);
      if (!isW && !isT) return;
      if (!map[a.repName]) map[a.repName] = { name: a.repName, today: emptyStat(), week: emptyStat(), todayEntries: [] };
      const rep = map[a.repName];
      if (isW) { rep.week.total++; rep.week.byType[a.type] = (rep.week.byType[a.type] ?? 0) + 1; }
      if (isT) { rep.today.total++; rep.today.byType[a.type] = (rep.today.byType[a.type] ?? 0) + 1; rep.todayEntries.push(a); }
    });
    return Object.values(map)
      .filter(r => !ownerDashboardReps || ownerDashboardReps.includes(r.name))
      .sort((a, b) => b.week.total - a.week.total);
  }, [activities, weekStart, ownerDashboardReps]);

  // Top-line totals across visible reps only
  const visibleNames = new Set(reps.map(r => r.name));
  const todayActs = activities.filter(a => isToday(new Date(a.date)) && visibleNames.has(a.repName));
  const weekActs  = activities.filter(a => inWeek(new Date(a.date)) && visibleNames.has(a.repName));
  const weekByType = weekActs.reduce((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  // Bar chart data — one group per visible rep
  const chartData = reps.map(r => {
    const src = chartView === 'today' ? r.today : r.week;
    return {
      name: r.name.split(' ')[0],
      calls:  src.byType['call']  ?? 0,
      visits: src.byType['visit'] ?? 0,
      emails: src.byType['email'] ?? 0,
      notes:  src.byType['note']  ?? 0,
    };
  });

  const toggleRep = (repName: string) => {
    if (!ownerDashboardReps) {
      setOwnerDashboardReps(allRepNames.filter(n => n !== repName));
    } else if (ownerDashboardReps.includes(repName)) {
      const next = ownerDashboardReps.filter(n => n !== repName);
      setOwnerDashboardReps(next.length === 0 ? null : next);
    } else {
      const next = [...ownerDashboardReps, repName];
      setOwnerDashboardReps(next.length === allRepNames.length ? null : next);
    }
  };

  const isRepVisible = (name: string) => !ownerDashboardReps || ownerDashboardReps.includes(name);

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">

      {/* Greeting + filter button */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{greeting}, {firstName} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here's what your team is doing — {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <button
          onClick={() => setShowFilter(v => !v)}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors flex-shrink-0 mt-1 ${
            showFilter ? 'bg-[#0F2A4A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Settings2 size={13} />
          {ownerDashboardReps ? `${ownerDashboardReps.length} reps` : 'All reps'}
        </button>
      </div>

      {/* Rep visibility filter panel (admin / owner control) */}
      {showFilter && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black text-gray-800 uppercase tracking-wider">Choose Reps to Display</p>
            {ownerDashboardReps && (
              <button
                onClick={() => setOwnerDashboardReps(null)}
                className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
              >
                <X size={10} /> Show all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allRepNames.length === 0 && (
              <p className="text-xs text-gray-400">No rep activity found this week.</p>
            )}
            {allRepNames.map(name => {
              const on = isRepVisible(name);
              const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <button
                  key={name}
                  onClick={() => toggleRep(name)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    on ? 'bg-[#0F2A4A] text-white border-[#0F2A4A]' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0 ${
                    on ? 'bg-amber-400 text-[#0F2A4A]' : 'bg-gray-200 text-gray-400'
                  }`}>{initials}</span>
                  {name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Two big totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#0F2A4A] rounded-2xl p-5 text-center">
          <p className="text-[11px] font-bold text-blue-300 uppercase tracking-widest">Today</p>
          <p className="text-5xl font-black text-amber-400 mt-2">{todayActs.length}</p>
          <p className="text-xs text-blue-300 mt-1">activities logged</p>
        </div>
        <div className="bg-[#0F2A4A] rounded-2xl p-5 text-center">
          <p className="text-[11px] font-bold text-blue-300 uppercase tracking-widest">This Week</p>
          <p className="text-5xl font-black text-amber-400 mt-2">{weekActs.length}</p>
          <p className="text-xs text-blue-300 mt-1">activities logged</p>
        </div>
      </div>

      {/* Week type breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {(['call', 'visit', 'email', 'note'] as const).map(type => (
          <div key={type} className="bg-white rounded-xl border border-gray-100 px-2 py-3 text-center">
            <p className={`text-2xl font-black ${TYPE_COLOR[type]}`}>{weekByType[type] ?? 0}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-0.5 capitalize">{TYPE_LABEL[type]}</p>
          </div>
        ))}
      </div>

      {/* ── Bar chart: one group per rep ───────────────────────── */}
      {reps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-black text-gray-800 uppercase tracking-wider">Activity by Rep</p>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[10px] font-bold">
              {(['today', 'week'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setChartView(v)}
                  className={`px-3 py-1.5 transition-colors ${
                    chartView === v ? 'bg-[#0F2A4A] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {v === 'today' ? 'Today' : 'This Week'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={12} barGap={2} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              <Bar dataKey="calls"  name="Calls"  fill={BAR_COLORS.calls}  radius={[3,3,0,0]} />
              <Bar dataKey="visits" name="Visits" fill={BAR_COLORS.visits} radius={[3,3,0,0]} />
              <Bar dataKey="emails" name="Emails" fill={BAR_COLORS.emails} radius={[3,3,0,0]} />
              <Bar dataKey="notes"  name="Notes"  fill={BAR_COLORS.notes}  radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-rep cards */}
      <div>
        <h2 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-3">By Rep</h2>
        {reps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-gray-400 font-medium">No activity logged this week yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reps.map(rep => {
              const isOpen = expandedRep === rep.name;
              const initials = rep.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={rep.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setExpandedRep(isOpen ? null : rep.name)}
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base truncate">{rep.name}</p>
                      <div className="flex gap-2.5 mt-0.5 flex-wrap">
                        {(['call', 'visit', 'email', 'note'] as const)
                          .filter(t => rep.week.byType[t])
                          .map(t => (
                            <span key={t} className={`text-xs font-semibold ${TYPE_COLOR[t]}`}>
                              {rep.week.byType[t]} {TYPE_LABEL[t]}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="flex items-stretch gap-3 flex-shrink-0">
                      <div className="text-center px-2">
                        <p className="text-2xl font-black text-gray-900 leading-none">{rep.today.total}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">Today</p>
                      </div>
                      <div className="w-px bg-gray-100" />
                      <div className="text-center px-2">
                        <p className="text-2xl font-black text-amber-500 leading-none">{rep.week.total}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">Week</p>
                      </div>
                      {isOpen ? <ChevronUp size={16} className="text-gray-400 self-center" /> : <ChevronDown size={16} className="text-gray-400 self-center" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100">
                      <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Today's Activity</p>
                      {rep.todayEntries.length === 0 ? (
                        <p className="px-4 pb-4 text-xs text-gray-400">Nothing logged today.</p>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {rep.todayEntries
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(act => {
                              const cust = customers.find(c =>
                                c.id === act.customerId || c.name.toLowerCase() === act.customerId.toLowerCase()
                              );
                              return (
                                <div key={act.id} className="flex items-start gap-3 px-4 py-2.5">
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${
                                    act.type === 'call'  ? 'bg-blue-100 text-blue-600' :
                                    act.type === 'visit' ? 'bg-green-100 text-green-600' :
                                    act.type === 'email' ? 'bg-red-100 text-red-500' :
                                                           'bg-gray-100 text-gray-500'
                                  }`}>{act.type}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{cust?.name ?? act.customerId}</p>
                                    {act.summary && <p className="text-xs text-gray-400 truncate mt-0.5">{act.summary.replace(/^\[[^\]]+\]\s*/, '')}</p>}
                                  </div>
                                  <span className="text-xs text-gray-400 flex-shrink-0">{safeFormat(act.date, 'h:mm a')}</span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
