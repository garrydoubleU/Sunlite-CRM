import { useState, useEffect, useMemo } from 'react';
import { Users, AlertTriangle, Clock, TrendingUp, Phone, Mail, MapPin, FileText, KeyRound, Check, X, ChevronDown, ChevronUp, Settings2, X as XIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCustomerStore } from '../store/customerStore';
import { useSettingsStore } from '../store/settingsStore';
import { safeDaysSince, safeFormat } from '../utils/scheduler';
import { startOfWeek, isToday, isThisWeek } from 'date-fns';
import CustomerModal from '../components/CustomerModal';
import type { Customer } from '../types';
import { looksLikeEmail } from '../utils/scheduler';

const BAR_COLORS: Record<string, string> = { calls: '#2563EB', visits: '#16A34A', emails: '#EF4444', notes: '#9CA3AF' };
const TYPE_COLOR: Record<string, string> = { call: 'text-blue-600', visit: 'text-green-600', email: 'text-red-500', note: 'text-gray-500' };
const TYPE_LABEL: Record<string, string> = { call: 'calls', visit: 'visits', email: 'emails', note: 'notes' };
type RepStat = { byType: Record<string, number>; total: number };
const emptyStat = (): RepStat => ({ byType: {}, total: 0 });

const TIER_STYLE: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-red-100',    text: 'text-red-600' },
  2: { bg: 'bg-amber-100',  text: 'text-amber-600' },
  3: { bg: 'bg-blue-100',   text: 'text-blue-500' },
  4: { bg: 'bg-gray-100',   text: 'text-gray-500' },
};

const ACT_ICON: Record<string, { icon: typeof Phone; color: string }> = {
  call:  { icon: Phone,    color: 'bg-blue-100 text-blue-600' },
  visit: { icon: MapPin,   color: 'bg-green-100 text-green-600' },
  email: { icon: Mail,     color: 'bg-red-100 text-red-500' },
  note:  { icon: FileText, color: 'bg-gray-100 text-gray-500' },
};

export default function AdminDashboard() {
  const { customers, activities, accessRequests, loadAccessRequests, resolveAccessRequest } = useCustomerStore();
  const { ownerDashboardReps, setOwnerDashboardReps } = useSettingsStore();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [untouchedTier, setUntouchedTier] = useState<number>(1);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [chartView, setChartView] = useState<'today' | 'week'>('today');

  useEffect(() => { loadAccessRequests(); }, [loadAccessRequests]);
  const pendingRequests = accessRequests.filter(r => r.status === 'pending');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Owner-style team stats ─────────────────────────────────────
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const inWeek = (d: Date) => isThisWeek(d, { weekStartsOn: 1 }) || d >= weekStart;

  const allRepNames = useMemo(() => {
    const names = new Set<string>();
    activities.forEach(a => { const d = new Date(a.date); if (isToday(d) || inWeek(d)) names.add(a.repName); });
    return Array.from(names).sort();
  }, [activities, weekStart]);

  const reps = useMemo(() => {
    const map: Record<string, { name: string; today: RepStat; week: RepStat; todayEntries: typeof activities }> = {};
    activities.forEach(a => {
      const d = new Date(a.date);
      const isT = isToday(d); const isW = inWeek(d);
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

  const visibleNames = new Set(reps.map(r => r.name));
  const todayActs = activities.filter(a => isToday(new Date(a.date)) && visibleNames.has(a.repName));
  const weekActs  = activities.filter(a => inWeek(new Date(a.date)) && visibleNames.has(a.repName));
  const weekByType = weekActs.reduce((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const chartData = reps.map(r => {
    const src = chartView === 'today' ? r.today : r.week;
    return { name: r.name.split(' ')[0], calls: src.byType['call'] ?? 0, visits: src.byType['visit'] ?? 0, emails: src.byType['email'] ?? 0, notes: src.byType['note'] ?? 0 };
  });
  const toggleRep = (repName: string) => {
    if (!ownerDashboardReps) setOwnerDashboardReps(allRepNames.filter(n => n !== repName));
    else if (ownerDashboardReps.includes(repName)) { const next = ownerDashboardReps.filter(n => n !== repName); setOwnerDashboardReps(next.length === 0 ? null : next); }
    else { const next = [...ownerDashboardReps, repName]; setOwnerDashboardReps(next.length === allRepNames.length ? null : next); }
  };
  const isRepVisible = (name: string) => !ownerDashboardReps || ownerDashboardReps.includes(name);

  // ── Stats ──────────────────────────────────────────────────────
  const active = customers.filter(c => c.activeStatus);
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>;
  active.forEach(c => { tierCounts[Math.min(c.priorityTier, 4) as 1]++; });

  const untouched30 = active.filter(c => safeDaysSince(c.lastContactDate) >= 30);
  const untouched60 = active.filter(c => safeDaysSince(c.lastContactDate) >= 60);

  // ── Today's activity ───────────────────────────────────────────
  const todayActivities = activities
    .filter(a => new Date(a.date) >= today)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Follow-ups due ─────────────────────────────────────────────
  const followUps = activities
    .filter(a => a.followUpDate && new Date(a.followUpDate) >= today)
    .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())
    .slice(0, 15);

  // ── Untouched by tier ──────────────────────────────────────────
  const untouchedByTier = active
    .filter(c => safeDaysSince(c.lastContactDate) >= 30 && Math.min(c.priorityTier, 4) === untouchedTier)
    .sort((a, b) => safeDaysSince(b.lastContactDate) - safeDaysSince(a.lastContactDate))
    .slice(0, 20);

  return (
    <div className="space-y-5">

      {/* ── Top stat row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users size={15} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Accounts</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{active.length}</p>
          <p className="text-[10px] text-gray-400 mt-1">{customers.length - active.length} inactive</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={15} className="text-red-500" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Untouched</span>
          </div>
          <p className="text-3xl font-black text-red-500">{untouched30.length}</p>
          <p className="text-[10px] text-gray-400 mt-1">{untouched60.length} over 60 days</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp size={15} className="text-green-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Logged Today</span>
          </div>
          <p className="text-3xl font-black text-gray-900">{todayActivities.length}</p>
          <p className="text-[10px] text-gray-400 mt-1">{reps.length} reps active</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock size={15} className="text-amber-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Follow-ups</span>
          </div>
          <p className="text-3xl font-black text-amber-600">{followUps.length}</p>
          <p className="text-[10px] text-gray-400 mt-1">scheduled ahead</p>
        </div>
      </div>

      {/* ── Tier health strip ──────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {([1, 2, 3, 4] as const).map(t => (
          <div key={t} className={`rounded-2xl p-3 text-center border ${TIER_STYLE[t].bg} border-transparent`}>
            <p className={`text-2xl font-black ${TIER_STYLE[t].text}`}>{tierCounts[t]}</p>
            <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${TIER_STYLE[t].text} opacity-70`}>Tier {t}</p>
          </div>
        ))}
      </div>

      {/* ── Account access requests ──────────────────────────────── */}
      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <KeyRound size={14} className="text-amber-600" />
            <h3 className="text-xs font-black text-amber-700 uppercase tracking-wider">Access Requests</h3>
            <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full ml-auto">{pendingRequests.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {req.requesterName || req.requesterEmail} wants access to <span className="font-black">{req.customerName}</span>
                    {req.customerId && <span className="text-gray-400 font-mono font-normal text-xs"> · {req.customerId}</span>}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">{req.requesterEmail} · {safeFormat(req.date, 'MMM d, h:mm a')}</p>
                </div>
                <button
                  onClick={() => resolveAccessRequest(req.id, true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                >
                  <Check size={12} /> Grant
                </button>
                <button
                  onClick={() => resolveAccessRequest(req.id, false)}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                >
                  <X size={12} /> Deny
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Untouched accounts — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500" />
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Untouched 30+ Days</h3>
            </div>
            {/* Tier filter tabs */}
            <div className="flex gap-1">
              {([1, 2, 3, 4] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setUntouchedTier(t)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                    untouchedTier === t
                      ? `${TIER_STYLE[t].bg} ${TIER_STYLE[t].text}`
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  T{t}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {untouchedByTier.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">No untouched Tier {untouchedTier} accounts.</p>
            )}
            {untouchedByTier.map(c => {
              const days = safeDaysSince(c.lastContactDate);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${TIER_STYLE[Math.min(c.priorityTier,4) as 1].bg} ${TIER_STYLE[Math.min(c.priorityTier,4) as 1].text}`}>
                    T{c.priorityTier}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{c.assignedRepName} · {c.territory}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    days >= 90 ? 'bg-red-100 text-red-600' :
                    days >= 60 ? 'bg-orange-100 text-orange-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>{days}d</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column — follow-ups only */}
        <div className="space-y-5">

          {/* Follow-ups */}
          {followUps.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={13} className="text-amber-500" />
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Follow-ups Due</h3>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {followUps.map(act => {
                  const customer = customers.find(c =>
                    c.id === act.customerId || c.name.toLowerCase() === act.customerId.toLowerCase()
                  );
                  const daysUntil = Math.round((new Date(act.followUpDate!).getTime() - today.getTime()) / 86400000);
                  return (
                    <button
                      key={act.id}
                      onClick={() => customer && setSelectedCustomer(customer)}
                      className="w-full flex items-center gap-2 p-2 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-amber-800 truncate">{customer?.name ?? act.customerId}</p>
                        <p className="text-[10px] text-gray-500 truncate">{act.repName}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        daysUntil <= 0 ? 'bg-red-100 text-red-600' :
                        daysUntil <= 2 ? 'bg-amber-200 text-amber-800' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {daysUntil <= 0 ? 'NOW' : daysUntil === 1 ? 'TMR' : `${daysUntil}d`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Owner-style team stats ─────────────────────────────── */}

      {/* Filter button */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-gray-800 uppercase tracking-wider">Team Performance</p>
        <button
          onClick={() => setShowFilter(v => !v)}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors ${
            showFilter ? 'bg-[#0F2A4A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Settings2 size={13} />
          {ownerDashboardReps ? `${ownerDashboardReps.length} reps` : 'All reps'}
        </button>
      </div>

      {showFilter && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black text-gray-800 uppercase tracking-wider">Choose Reps to Display</p>
            {ownerDashboardReps && (
              <button onClick={() => setOwnerDashboardReps(null)} className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-0.5">
                <XIcon size={10} /> Show all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allRepNames.length === 0 && <p className="text-xs text-gray-400">No rep activity found this week.</p>}
            {allRepNames.map(name => {
              const on = isRepVisible(name);
              const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <button key={name} onClick={() => toggleRep(name)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${on ? 'bg-[#0F2A4A] text-white border-[#0F2A4A]' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0 ${on ? 'bg-amber-400 text-[#0F2A4A]' : 'bg-gray-200 text-gray-400'}`}>{initials}</span>
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

      {/* Bar chart */}
      {reps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-black text-gray-800 uppercase tracking-wider">Activity by Rep</p>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[10px] font-bold">
              {(['today', 'week'] as const).map(v => (
                <button key={v} onClick={() => setChartView(v)}
                  className={`px-3 py-1.5 transition-colors ${chartView === v ? 'bg-[#0F2A4A] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  {v === 'today' ? 'Today' : 'This Week'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={12} barGap={2} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }} cursor={{ fill: '#f9fafb' }} />
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
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 font-medium">No activity logged this week yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reps.map(rep => {
              const isOpen = expandedRep === rep.name;
              const initials = rep.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={rep.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setExpandedRep(isOpen ? null : rep.name)}>
                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">{initials}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base truncate">{rep.name}</p>
                      <div className="flex gap-2.5 mt-0.5 flex-wrap">
                        {(['call', 'visit', 'email', 'note'] as const).filter(t => rep.week.byType[t]).map(t => (
                          <span key={t} className={`text-xs font-semibold ${TYPE_COLOR[t]}`}>{rep.week.byType[t]} {TYPE_LABEL[t]}</span>
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
                          {rep.todayEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(act => {
                            const cust = customers.find(c => c.id === act.customerId || c.name.toLowerCase() === act.customerId.toLowerCase());
                            return (
                              <div key={act.id} className="flex items-start gap-3 px-4 py-2.5">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${
                                  act.type === 'call' ? 'bg-blue-100 text-blue-600' : act.type === 'visit' ? 'bg-green-100 text-green-600' : act.type === 'email' ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500'
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

      {/* ── Recent activity feed ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-4">Recent Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activities
            .filter(a => !looksLikeEmail(a.summary) || a.type === 'email')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 12)
            .map(act => {
              const customer = customers.find(c =>
                c.id === act.customerId || c.name.toLowerCase() === act.customerId.toLowerCase()
              );
              const { icon: Icon, color } = ACT_ICON[act.type] ?? ACT_ICON.note;
              return (
                <button
                  key={act.id}
                  onClick={() => customer && setSelectedCustomer(customer)}
                  className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left w-full"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-gray-800 truncate">{customer?.name ?? act.customerId}</p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{safeFormat(act.date, 'MMM d')}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{act.summary.replace(/^\[[^\]]+\]\s*/, '')}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{act.repName}</p>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}
