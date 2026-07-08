import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { startOfWeek, isToday, isThisWeek } from 'date-fns';
import { useCustomerStore } from '../store/customerStore';
import { useSettingsStore } from '../store/settingsStore';
import CustomerModal from '../components/CustomerModal';
import { safeDaysSince, safeFormat, looksLikeEmail } from '../utils/scheduler';
import type { Activity, ActivityType, Customer, PriorityTier } from '../types';

const BAR_COLORS: Record<string, string> = {
  calls: '#2563EB',
  visits: '#16A34A',
  emails: '#EF4444',
  notes: '#64748B',
};

const TYPE_COLOR: Record<ActivityType, string> = {
  call: 'text-blue-600',
  visit: 'text-green-600',
  email: 'text-red-500',
  note: 'text-slate-500',
};

const TYPE_LABEL: Record<ActivityType, string> = {
  call: 'Calls',
  visit: 'Visits',
  email: 'Emails',
  note: 'Notes',
};

type RepStat = { byType: Partial<Record<ActivityType, number>>; total: number };
type RepRow = { name: string; today: RepStat; week: RepStat; todayEntries: Activity[] };

const emptyStat = (): RepStat => ({ byType: {}, total: 0 });

const TIER_STYLE: Record<PriorityTier, { bg: string; text: string; soft: string }> = {
  1: { bg: 'bg-red-500', text: 'text-red-600', soft: 'bg-red-50' },
  2: { bg: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50' },
  3: { bg: 'bg-blue-500', text: 'text-blue-600', soft: 'bg-blue-50' },
  4: { bg: 'bg-slate-500', text: 'text-slate-600', soft: 'bg-slate-50' },
};

const ACT_ICON: Record<ActivityType, { icon: typeof Phone; color: string }> = {
  call: { icon: Phone, color: 'bg-blue-100 text-blue-600' },
  visit: { icon: MapPin, color: 'bg-green-100 text-green-600' },
  email: { icon: Mail, color: 'bg-red-100 text-red-500' },
  note: { icon: FileText, color: 'bg-slate-100 text-slate-500' },
};

function tierOf(customer: Customer): PriorityTier {
  return Math.min(customer.priorityTier, 4) as PriorityTier;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminDashboard() {
  const { customers, activities, accessRequests, loadAccessRequests, resolveAccessRequest } = useCustomerStore();
  const { ownerDashboardReps, setOwnerDashboardReps } = useSettingsStore();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [untouchedTier, setUntouchedTier] = useState<PriorityTier>(1);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [chartView, setChartView] = useState<'today' | 'week'>('today');

  useEffect(() => { loadAccessRequests(); }, [loadAccessRequests]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const inWeek = (d: Date) => isThisWeek(d, { weekStartsOn: 1 }) || d >= weekStart;

  const active = customers.filter(c => c.activeStatus);
  const inactiveCount = Math.max(customers.length - active.length, 0);
  const pendingRequests = accessRequests.filter(r => r.status === 'pending');

  const tierCounts = active.reduce((acc, customer) => {
    const tier = tierOf(customer);
    acc[tier] = (acc[tier] ?? 0) + 1;
    return acc;
  }, { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<PriorityTier, number>);

  const untouched30 = active.filter(c => safeDaysSince(c.lastContactDate) >= 30);
  const untouched60 = active.filter(c => safeDaysSince(c.lastContactDate) >= 60);
  const untouched90 = active.filter(c => safeDaysSince(c.lastContactDate) >= 90);

  const followUps = activities
    .filter(a => a.followUpDate && new Date(a.followUpDate) >= today)
    .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())
    .slice(0, 10);

  const untouchedByTier = active
    .filter(c => safeDaysSince(c.lastContactDate) >= 30 && tierOf(c) === untouchedTier)
    .sort((a, b) => safeDaysSince(b.lastContactDate) - safeDaysSince(a.lastContactDate))
    .slice(0, 12);

  const allRepNames = useMemo(() => {
    const names = new Set<string>();
    activities.forEach(a => {
      const date = new Date(a.date);
      if ((isToday(date) || inWeek(date)) && a.repName) names.add(a.repName);
    });
    return Array.from(names).sort();
  }, [activities, weekStart]);

  const reps = useMemo<RepRow[]>(() => {
    const map: Record<string, RepRow> = {};

    activities.forEach(activity => {
      const date = new Date(activity.date);
      const isT = isToday(date);
      const isW = inWeek(date);
      if (!isT && !isW) return;

      if (!map[activity.repName]) {
        map[activity.repName] = {
          name: activity.repName,
          today: emptyStat(),
          week: emptyStat(),
          todayEntries: [],
        };
      }

      const rep = map[activity.repName];
      if (isW) {
        rep.week.total += 1;
        rep.week.byType[activity.type] = (rep.week.byType[activity.type] ?? 0) + 1;
      }
      if (isT) {
        rep.today.total += 1;
        rep.today.byType[activity.type] = (rep.today.byType[activity.type] ?? 0) + 1;
        rep.todayEntries.push(activity);
      }
    });

    return Object.values(map)
      .filter(rep => !ownerDashboardReps || ownerDashboardReps.includes(rep.name))
      .sort((a, b) => b.week.total - a.week.total);
  }, [activities, weekStart, ownerDashboardReps]);

  const visibleNames = new Set(reps.map(r => r.name));
  const todayActs = activities.filter(a => isToday(new Date(a.date)) && visibleNames.has(a.repName));
  const weekActs = activities.filter(a => inWeek(new Date(a.date)) && visibleNames.has(a.repName));
  const activeRepCount = reps.filter(rep => rep.week.total > 0).length;

  const weekByType = weekActs.reduce((acc, activity) => {
    acc[activity.type] = (acc[activity.type] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<ActivityType, number>>);

  const chartData = reps.slice(0, 10).map(rep => {
    const source = chartView === 'today' ? rep.today : rep.week;
    return {
      name: rep.name.split(' ')[0],
      calls: source.byType.call ?? 0,
      visits: source.byType.visit ?? 0,
      emails: source.byType.email ?? 0,
      notes: source.byType.note ?? 0,
    };
  });

  const topRep = reps[0];
  const accountTouchRate = percent(active.length - untouched30.length, active.length);
  const criticalPercent = percent(untouched60.length, active.length);

  const toggleRep = (repName: string) => {
    if (!ownerDashboardReps) {
      setOwnerDashboardReps(allRepNames.filter(name => name !== repName));
      return;
    }

    if (ownerDashboardReps.includes(repName)) {
      const next = ownerDashboardReps.filter(name => name !== repName);
      setOwnerDashboardReps(next.length === 0 ? null : next);
      return;
    }

    const next = [...ownerDashboardReps, repName];
    setOwnerDashboardReps(next.length === allRepNames.length ? null : next);
  };

  const isRepVisible = (name: string) => !ownerDashboardReps || ownerDashboardReps.includes(name);

  return (
    <div className="space-y-5 max-w-[1500px] mx-auto">
      <section className="rounded-2xl bg-[#0F2A4A] text-white overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_2fr]">
          <div className="p-5 sm:p-6 border-b xl:border-b-0 xl:border-r border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-[#0F2A4A] flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200">Admin command center</p>
                <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
              </div>
            </div>
            <p className="mt-4 text-sm text-blue-100 max-w-xl">
              Team activity, untouched accounts, follow-ups, and access approvals in one clean operating view.
            </p>
            <div className="grid grid-cols-3 gap-3 mt-5">
              <div>
                <p className="text-3xl font-black text-amber-300">{todayActs.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Today</p>
              </div>
              <div>
                <p className="text-3xl font-black text-amber-300">{weekActs.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">This week</p>
              </div>
              <div>
                <p className="text-3xl font-black text-amber-300">{activeRepCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Active reps</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/10">
            <SummaryTile label="Accounts" value={active.length} helper={`${inactiveCount} inactive`} icon={Users} tone="blue" />
            <SummaryTile label="Untouched" value={untouched30.length} helper={`${untouched60.length} over 60 days`} icon={AlertTriangle} tone="red" />
            <SummaryTile label="Touch rate" value={`${accountTouchRate}%`} helper={`${criticalPercent}% critical`} icon={TrendingUp} tone="green" />
            <SummaryTile label="Follow-ups" value={followUps.length} helper="scheduled ahead" icon={Clock} tone="amber" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([1, 2, 3, 4] as PriorityTier[]).map(tier => (
          <div key={tier} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tier {tier}</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{tierCounts[tier]}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${TIER_STYLE[tier].soft} ${TIER_STYLE[tier].text} flex items-center justify-center font-black text-sm`}>
                T{tier}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 mt-3 overflow-hidden">
              <div className={`h-full ${TIER_STYLE[tier].bg}`} style={{ width: `${percent(tierCounts[tier], active.length)}%` }} />
            </div>
          </div>
        ))}
      </section>

      {pendingRequests.length > 0 && (
        <section className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <KeyRound size={16} className="text-amber-600" />
            <h2 className="text-xs font-black text-amber-800 uppercase tracking-wider">Access requests</h2>
            <span className="ml-auto text-[10px] font-black bg-amber-500 text-white px-2 py-1 rounded-full">{pendingRequests.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingRequests.map(request => (
              <div key={request.id} className="flex flex-col md:flex-row md:items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {request.requesterName || request.requesterEmail} wants access to {request.customerName}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {request.requesterEmail} · {request.customerId} · {safeFormat(request.date, 'MMM d, h:mm a')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveAccessRequest(request.id, true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Check size={13} /> Grant
                  </button>
                  <button
                    onClick={() => resolveAccessRequest(request.id, false)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
                  >
                    <X size={13} /> Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)] gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Needs attention</h2>
                <p className="text-[11px] text-slate-400">Accounts with no contact in 30+ days</p>
              </div>
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {([1, 2, 3, 4] as PriorityTier[]).map(tier => (
                <button
                  key={tier}
                  onClick={() => setUntouchedTier(tier)}
                  className={`h-8 px-3 rounded-lg text-[11px] font-black transition-colors ${
                    untouchedTier === tier ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  T{tier}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50/70">
            <RiskStat label="30+ days" value={untouched30.length} tone="amber" />
            <RiskStat label="60+ days" value={untouched60.length} tone="orange" />
            <RiskStat label="90+ days" value={untouched90.length} tone="red" />
          </div>

          <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
            {untouchedByTier.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No untouched Tier {untouchedTier} accounts.</p>
            ) : untouchedByTier.map(customer => {
              const days = safeDaysSince(customer.lastContactDate);
              const tier = tierOf(customer);
              return (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className={`w-9 h-9 rounded-xl ${TIER_STYLE[tier].soft} ${TIER_STYLE[tier].text} flex items-center justify-center text-[11px] font-black`}>
                    T{tier}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{customer.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{customer.assignedRepName || 'Unassigned'} · {customer.territory || 'No territory'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex text-[11px] font-black px-2.5 py-1 rounded-full ${
                      days >= 90 ? 'bg-red-100 text-red-600' :
                      days >= 60 ? 'bg-orange-100 text-orange-600' :
                      'bg-amber-100 text-amber-700'
                    }`}>{days}d</span>
                    <p className="text-[10px] text-slate-400 mt-1">last touch</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-500" />
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Upcoming follow-ups</h2>
              </div>
              <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2 py-1 rounded-full">{followUps.length}</span>
            </div>
            <div className="space-y-2 max-h-[265px] overflow-y-auto pr-1">
              {followUps.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No scheduled follow-ups ahead.</p>
              ) : followUps.map(activity => {
                const customer = customers.find(c => c.id === activity.customerId || c.name.toLowerCase() === activity.customerId.toLowerCase());
                const daysUntil = Math.round((new Date(activity.followUpDate!).getTime() - today.getTime()) / 86400000);
                return (
                  <button
                    key={activity.id}
                    onClick={() => customer && setSelectedCustomer(customer)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-950 truncate">{customer?.name ?? activity.customerId}</p>
                      <p className="text-[11px] text-amber-700/70 truncate">{activity.repName}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                      daysUntil <= 0 ? 'bg-red-100 text-red-600' :
                      daysUntil <= 2 ? 'bg-amber-200 text-amber-800' :
                      'bg-white text-amber-700'
                    }`}>
                      {daysUntil <= 0 ? 'NOW' : daysUntil === 1 ? 'TMR' : `${daysUntil}d`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-blue-600" />
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Week mix</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['call', 'visit', 'email', 'note'] as ActivityType[]).map(type => (
                <div key={type} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className={`text-2xl font-black ${TYPE_COLOR[type]}`}>{weekByType[type] ?? 0}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{TYPE_LABEL[type]}</p>
                </div>
              ))}
            </div>
            {topRep && (
              <div className="mt-4 rounded-xl bg-[#0F2A4A] text-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Top this week</p>
                <div className="flex items-center justify-between gap-3 mt-2">
                  <p className="font-black truncate">{topRep.name}</p>
                  <p className="text-2xl font-black text-amber-300">{topRep.week.total}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Team performance</h2>
            <p className="text-[11px] text-slate-400 mt-1">Activity by rep, filtered to the people you want visible.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden border border-slate-200 text-[11px] font-black">
              {(['today', 'week'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setChartView(view)}
                  className={`px-3 py-2 transition-colors ${chartView === view ? 'bg-[#0F2A4A] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                  {view === 'today' ? 'Today' : 'This week'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors ${
                showFilter ? 'bg-[#0F2A4A] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Settings2 size={13} />
              {ownerDashboardReps ? `${ownerDashboardReps.length} reps` : 'All reps'}
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Choose reps to display</p>
              {ownerDashboardReps && (
                <button onClick={() => setOwnerDashboardReps(null)} className="text-[11px] font-black text-amber-600 hover:text-amber-700 flex items-center gap-1">
                  <X size={11} /> Show all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {allRepNames.length === 0 && <p className="text-xs text-slate-400">No rep activity found this week.</p>}
              {allRepNames.map(name => {
                const on = isRepVisible(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleRep(name)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      on ? 'bg-[#0F2A4A] text-white border-[#0F2A4A]' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${on ? 'bg-amber-400 text-[#0F2A4A]' : 'bg-slate-200 text-slate-400'}`}>
                      {initials(name)}
                    </span>
                    {name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {reps.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px] gap-0">
            <div className="p-5 border-b xl:border-b-0 xl:border-r border-slate-100">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barSize={14} barGap={2} barCategoryGap="28%">
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 20px rgba(15, 42, 74, .08)' }} cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <Bar dataKey="calls" name="Calls" fill={BAR_COLORS.calls} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="visits" name="Visits" fill={BAR_COLORS.visits} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="emails" name="Emails" fill={BAR_COLORS.emails} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="notes" name="Notes" fill={BAR_COLORS.notes} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
              {reps.map(rep => {
                const open = expandedRep === rep.name;
                return (
                  <div key={rep.name}>
                    <button
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                      onClick={() => setExpandedRep(open ? null : rep.name)}
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-black text-xs shrink-0">
                        {initials(rep.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{rep.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{rep.today.total} today · {rep.week.total} this week</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <p className="text-xl font-black text-slate-900">{chartView === 'today' ? rep.today.total : rep.week.total}</p>
                        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </button>

                    {open && (
                      <div className="bg-slate-50 border-t border-slate-100 px-5 py-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Today's activity</p>
                        {rep.todayEntries.length === 0 ? (
                          <p className="text-xs text-slate-400 pb-1">Nothing logged today.</p>
                        ) : (
                          <div className="space-y-2">
                            {rep.todayEntries
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .slice(0, 5)
                              .map(activity => {
                                const customer = customers.find(c => c.id === activity.customerId || c.name.toLowerCase() === activity.customerId.toLowerCase());
                                return (
                                  <div key={activity.id} className="flex items-start gap-2 text-xs">
                                    <span className={`font-black uppercase px-2 py-0.5 rounded-full ${TYPE_COLOR[activity.type]} bg-white`}>{activity.type}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-slate-800 truncate">{customer?.name ?? activity.customerId}</p>
                                      {activity.summary && <p className="text-slate-400 truncate">{activity.summary.replace(/^\[[^\]]+\]\s*/, '')}</p>}
                                    </div>
                                    <span className="text-slate-400 shrink-0">{safeFormat(activity.date, 'h:mm a')}</span>
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
          </div>
        ) : (
          <div className="p-10 text-center text-slate-400 font-medium">No activity logged this week yet.</div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Recent activity</h2>
          <span className="text-[11px] font-bold text-slate-400">Latest 12</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {activities
            .filter(a => !looksLikeEmail(a.summary) || a.type === 'email')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 12)
            .map(activity => {
              const customer = customers.find(c => c.id === activity.customerId || c.name.toLowerCase() === activity.customerId.toLowerCase());
              const { icon: Icon, color } = ACT_ICON[activity.type] ?? ACT_ICON.note;
              return (
                <button
                  key={activity.id}
                  onClick={() => customer && setSelectedCustomer(customer)}
                  className="flex gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors text-left w-full"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 truncate">{customer?.name ?? activity.customerId}</p>
                      <span className="text-[10px] text-slate-400 shrink-0">{safeFormat(activity.date, 'MMM d')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{activity.summary.replace(/^\[[^\]]+\]\s*/, '')}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{activity.repName}</p>
                  </div>
                </button>
              );
            })}
        </div>
      </section>

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: typeof Users;
  tone: 'blue' | 'red' | 'green' | 'amber';
}) {
  const toneClass = {
    blue: 'bg-blue-400/15 text-blue-100',
    red: 'bg-red-400/15 text-red-100',
    green: 'bg-green-400/15 text-green-100',
    amber: 'bg-amber-400/20 text-amber-100',
  }[tone];

  return (
    <div className="p-5 min-h-[150px] flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClass}`}>
          <Icon size={17} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-wider text-blue-200">{label}</p>
      </div>
      <div>
        <p className="text-3xl font-black text-white">{value}</p>
        <p className="text-[11px] text-blue-200 mt-1">{helper}</p>
      </div>
    </div>
  );
}

function RiskStat({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'orange' | 'red' }) {
  const toneClass = {
    amber: 'text-amber-700',
    orange: 'text-orange-600',
    red: 'text-red-600',
  }[tone];

  return (
    <div className="px-5 py-3 text-center">
      <p className={`text-xl font-black ${toneClass}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
