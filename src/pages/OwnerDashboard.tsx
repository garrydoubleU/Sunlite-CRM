import { useMemo } from 'react';
import { Users, PhoneCall, Navigation, Mail, FileText, TrendingUp } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { safeFormat } from '../utils/scheduler';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { startOfWeek, eachDayOfInterval, endOfWeek, isSameDay, isToday } from 'date-fns';

const TYPE_COLOR: Record<string, string> = {
  call:  'bg-blue-100 text-blue-600',
  visit: 'bg-green-100 text-green-600',
  email: 'bg-red-100 text-red-500',
  note:  'bg-gray-100 text-gray-500',
};
const TYPE_ICON: Record<string, typeof PhoneCall> = {
  call:  PhoneCall,
  visit: Navigation,
  email: Mail,
  note:  FileText,
};
const TYPE_LABEL: Record<string, string> = {
  call: 'Phone Calls', visit: 'Field Visits', email: 'Emails', note: 'Notes',
};

export default function OwnerDashboard() {
  const { activities } = useCustomerStore();

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Mon
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(now, { weekStartsOn: 1 }) });

  const todayActs = activities.filter(a => isToday(new Date(a.date)));
  const weekActs  = activities.filter(a => new Date(a.date) >= weekStart);

  // Counts by type
  const countByType = (list: typeof activities) =>
    list.reduce((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  const todayCounts = countByType(todayActs);
  const weekCounts  = countByType(weekActs);

  // Per-rep breakdown for today
  const repToday = useMemo(() => {
    const map: Record<string, { name: string; call: number; visit: number; email: number; note: number; total: number }> = {};
    todayActs.forEach(a => {
      if (!map[a.repName]) map[a.repName] = { name: a.repName, call: 0, visit: 0, email: 0, note: 0, total: 0 };
      map[a.repName][a.type as 'call']++;
      map[a.repName].total++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [todayActs]);

  // Per-rep breakdown for the week
  const repWeek = useMemo(() => {
    const map: Record<string, { name: string; call: number; visit: number; email: number; note: number; total: number }> = {};
    weekActs.forEach(a => {
      if (!map[a.repName]) map[a.repName] = { name: a.repName, call: 0, visit: 0, email: 0, note: 0, total: 0 };
      map[a.repName][a.type as 'call']++;
      map[a.repName].total++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [weekActs]);

  // Day-by-day chart for the week
  const dayChart = weekDays.map(day => {
    const dayActs = weekActs.filter(a => isSameDay(new Date(a.date), day));
    return {
      label: safeFormat(day.toISOString(), 'EEE'),
      total: dayActs.length,
      calls: dayActs.filter(a => a.type === 'call').length,
      today: isToday(day),
    };
  });

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* ── Big today numbers ─────────────────────────────── */}
      <div className="bg-[#0F2A4A] rounded-2xl p-5 text-white">
        <p className="text-[11px] font-bold text-blue-300 uppercase tracking-widest mb-4">Today's Activity</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['call', 'visit', 'email', 'note'] as const).map(type => {
            const Icon = TYPE_ICON[type];
            const count = todayCounts[type] ?? 0;
            return (
              <div key={type} className="bg-white/10 rounded-xl p-4 text-center">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-2">
                  <Icon size={18} className="text-amber-300" />
                </div>
                <p className="text-4xl font-black text-white">{count}</p>
                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mt-1">{TYPE_LABEL[type]}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-sm text-blue-200">Total actions today</span>
          <span className="text-3xl font-black text-amber-400">{todayActs.length}</span>
        </div>
      </div>

      {/* ── Day-by-day bar strip ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-black text-gray-800 uppercase tracking-wider">This Week</p>
          <span className="text-xs text-gray-400">{weekActs.length} total actions</span>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={dayChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, 'Actions']} labelStyle={{ fontWeight: 700 }} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {dayChart.map((d, i) => (
                <Cell key={i} fill={d.today ? '#F59E0B' : '#0F2A4A'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {(['call', 'visit', 'email', 'note'] as const).map(type => (
            <div key={type} className={`rounded-xl px-3 py-2 text-center ${TYPE_COLOR[type]}`}>
              <p className="text-xl font-black">{weekCounts[type] ?? 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{TYPE_LABEL[type]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rep leaderboard — Today ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Users size={14} className="text-amber-500" />
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Team — Today</h3>
        </div>
        {repToday.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">No activity logged today yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {repToday.map(rep => (
              <div key={rep.name} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                  {rep.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{rep.name}</p>
                  <div className="flex gap-2 mt-0.5">
                    {rep.call > 0 && <span className="text-[10px] text-blue-600 font-semibold">{rep.call} calls</span>}
                    {rep.visit > 0 && <span className="text-[10px] text-green-600 font-semibold">{rep.visit} visits</span>}
                    {rep.email > 0 && <span className="text-[10px] text-red-500 font-semibold">{rep.email} emails</span>}
                    {rep.note > 0 && <span className="text-[10px] text-gray-500 font-semibold">{rep.note} notes</span>}
                  </div>
                </div>
                <span className="text-2xl font-black text-amber-500 flex-shrink-0">{rep.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Rep leaderboard — This week ───────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <TrendingUp size={14} className="text-[#0F2A4A]" />
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Team — This Week</h3>
        </div>
        {repWeek.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">No activity this week.</p>
        ) : (
          <div>
            {/* Header */}
            <div className="grid grid-cols-6 gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <div className="col-span-2">Rep</div>
              <div className="text-center text-blue-500">Calls</div>
              <div className="text-center text-green-600">Visits</div>
              <div className="text-center text-red-500">Emails</div>
              <div className="text-center text-gray-800">Total</div>
            </div>
            <div className="divide-y divide-gray-50">
              {repWeek.map((rep, i) => (
                <div key={rep.name} className={`grid grid-cols-6 gap-2 px-5 py-3 items-center ${i === 0 ? 'bg-amber-50/50' : ''}`}>
                  <div className="col-span-2 flex items-center gap-2 min-w-0">
                    {i === 0 && <span className="text-[10px] font-black text-amber-500">★</span>}
                    <p className="text-sm font-semibold text-gray-800 truncate">{rep.name.split(' ')[0]}</p>
                  </div>
                  <div className="text-center text-sm font-bold text-blue-600">{rep.call || '—'}</div>
                  <div className="text-center text-sm font-bold text-green-600">{rep.visit || '—'}</div>
                  <div className="text-center text-sm font-bold text-red-500">{rep.email || '—'}</div>
                  <div className="text-center text-sm font-black text-gray-900">{rep.total}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
