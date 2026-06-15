import { useState, useEffect } from 'react';
import { Users, AlertTriangle, Clock, TrendingUp, Phone, Mail, MapPin, FileText, KeyRound, Check, X } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { safeDaysSince, safeFormat } from '../utils/scheduler';
import CustomerModal from '../components/CustomerModal';
import type { Customer } from '../types';
import { looksLikeEmail } from '../utils/scheduler';

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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [untouchedTier, setUntouchedTier] = useState<number>(1);

  useEffect(() => { loadAccessRequests(); }, [loadAccessRequests]);
  const pendingRequests = accessRequests.filter(r => r.status === 'pending');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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

  // Group by rep
  const repActivity: Record<string, { name: string; count: number }> = {};
  todayActivities.forEach(a => {
    if (!repActivity[a.repName]) repActivity[a.repName] = { name: a.repName, count: 0 };
    repActivity[a.repName].count++;
  });
  const repSummary = Object.values(repActivity).sort((a, b) => b.count - a.count);

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
          <p className="text-[10px] text-gray-400 mt-1">{repSummary.length} reps active</p>
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

        {/* Right column — rep activity + follow-ups */}
        <div className="space-y-5">

          {/* Team activity today */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-3">Team Today</h3>
            {repSummary.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No activity logged yet today.</p>
            ) : (
              <div className="space-y-2">
                {repSummary.map(rep => (
                  <div key={rep.name} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {rep.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{rep.name}</p>
                    </div>
                    <span className="text-xs font-black text-amber-600">{rep.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  const daysUntil = Math.ceil((new Date(act.followUpDate!).getTime() - now.getTime()) / 86400000);
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
