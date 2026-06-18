import { useState, useEffect } from 'react';
import { Phone, Clock, CheckCircle, ChevronDown, ChevronUp, AlertCircle, ListChecks } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { safeDaysSince, safeFormat } from '../utils/scheduler';
import CustomerModal from '../components/CustomerModal';
import AssignmentAlert from '../components/AssignmentAlert';
import type { Customer } from '../types';

const TIER_STYLE: Record<number, { bg: string; text: string; ring: string }> = {
  1: { bg: 'bg-red-100',    text: 'text-red-600',    ring: 'ring-red-200' },
  2: { bg: 'bg-orange-100', text: 'text-orange-600',  ring: 'ring-orange-200' },
  3: { bg: 'bg-amber-100',  text: 'text-amber-600',  ring: 'ring-amber-200' },
  4: { bg: 'bg-blue-100',   text: 'text-blue-500',   ring: 'ring-blue-200' },
  5: { bg: 'bg-gray-100',   text: 'text-gray-500',   ring: 'ring-gray-200' },
};

function CallerCard({
  customer,
  daysAgo,
  followUpDate,
  onOpen,
  isFollowUp,
  isContacted,
}: {
  customer: Customer;
  daysAgo: number;
  followUpDate?: string;
  onOpen: () => void;
  isFollowUp: boolean;
  isContacted?: boolean;
}) {
  const tier = TIER_STYLE[customer.priorityTier] ?? TIER_STYLE[5];
  const todayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const daysUntilFollowUp = followUpDate
    ? Math.round((new Date(followUpDate).getTime() - todayMs) / 86400000)
    : null;

  return (
    <div
      onClick={onOpen}
      className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
        isFollowUp
          ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
          : isContacted
          ? 'bg-green-50 border-green-200 hover:bg-green-100'
          : 'bg-white border-gray-100 hover:bg-gray-50'
      }`}
    >
      {/* Priority badge */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm ring-2 ${tier.bg} ${tier.text} ${tier.ring}`}>
        P{customer.priorityTier}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold text-gray-900 truncate">{customer.name}</p>
          {isContacted && !isFollowUp && (
            <span className="text-[9px] font-bold bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">✓ Contacted</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-gray-500 truncate">
            {customer.phone || <span className="text-gray-300 italic">No phone</span>}
          </p>
          {customer.customerClass && (
            <span className="text-[9px] font-bold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0">{customer.customerClass}</span>
          )}
        </div>
        {isFollowUp && followUpDate && (
          <p className="text-[10px] font-semibold text-amber-600 mt-0.5">
            Follow-up: {daysUntilFollowUp === 0 ? 'TODAY' : daysUntilFollowUp === 1 ? 'TOMORROW' : daysUntilFollowUp! < 0 ? `${Math.abs(daysUntilFollowUp!)}d overdue` : `in ${daysUntilFollowUp}d`}
          </p>
        )}
      </div>

      {/* Days badge */}
      <div className="flex-shrink-0 text-right">
        {isFollowUp ? (
          <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${
            daysUntilFollowUp! <= 0 ? 'bg-red-100 text-red-600' :
            daysUntilFollowUp! <= 2 ? 'bg-amber-100 text-amber-700' :
            'bg-blue-100 text-blue-600'
          }`}>
            {daysUntilFollowUp! <= 0 ? '!' : safeFormat(followUpDate!, 'MMM d')}
          </div>
        ) : (
          <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${
            isContacted ? 'bg-green-100 text-green-600' :
            daysAgo >= 90 ? 'bg-red-100 text-red-600' :
            daysAgo >= 60 ? 'bg-orange-100 text-orange-600' :
            'bg-gray-100 text-gray-500'
          }`}>
            {daysAgo}d
          </div>
        )}
      </div>

      {/* Phone tap shortcut */}
      {customer.phone && (
        <a
          href={`tel:${customer.phone}`}
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center text-green-600 hover:bg-green-200 transition-colors"
        >
          <Phone size={15} />
        </a>
      )}
    </div>
  );
}

export default function CallerDashboard() {
  const { customers, activities, loadCSTasksSent } = useCustomerStore();
  const { currentUser } = useAuthStore();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [expandedPriority, setExpandedPriority] = useState<number | null>(1);
  const [mainTab, setMainTab] = useState<'queue' | 'tasks'>('queue');
  const now = new Date();

  useEffect(() => { loadCSTasksSent(); }, []);

  // My Tasks = activities this CS user logged with "notify rep" checked
  const myName = currentUser?.name ?? '';
  const notifyTasks = activities
    .filter(a => a.notifyRep === true && a.repName === myName)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Resolve customer name from customerId (activity.customerId may be name or id)
  const resolveCustomerName = (customerId: string): string => {
    const c = customers.find(x => x.id === customerId || x.name.toLowerCase() === customerId.toLowerCase());
    return c?.name ?? customerId;
  };

  // Customers logged today
  const calledToday = activities.filter(a => {
    const d = new Date(a.date);
    return (a.type === 'call' || a.type === 'note') &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  });

  // Follow-ups: my follow-up dates (scoped to current user), from today onwards
  // NOTE: activity.customerId may be customer name OR numeric ID — resolve to ID first
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const followUpMap = new Map<string, string>(); // customer.id → soonest upcoming followUpDate
  activities.filter(a => !myName || a.repName === myName).forEach(a => {
    if (!a.followUpDate) return;
    if (new Date(a.followUpDate) < todayMidnight) return;
    const customer = customers.find(c =>
      c.id === a.customerId || c.name.toLowerCase() === a.customerId.toLowerCase()
    );
    if (!customer) return;
    const existing = followUpMap.get(customer.id);
    if (!existing || new Date(a.followUpDate) < new Date(existing)) {
      followUpMap.set(customer.id, a.followUpDate);
    }
  });

  const followUpCustomers = customers
    .filter(c => c.activeStatus && followUpMap.has(c.id))
    .sort((a, b) => {
      const da = new Date(followUpMap.get(a.id)!).getTime();
      const db = new Date(followUpMap.get(b.id)!).getTime();
      return da - db;
    });

  // Effective last contact: most recent activity wins over stale GAS field
  const effectiveDaysAgo = (c: Customer): number => {
    const cName = c.name.toLowerCase();
    const latest = activities
      .filter(a => a.customerId === c.id || a.customerId.toLowerCase() === cName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const effectiveDate = latest
      ? (latest.date > (c.lastContactDate ?? '') ? latest.date : c.lastContactDate)
      : c.lastContactDate;
    return safeDaysSince(effectiveDate);
  };

  // Priority queue: all active customers not in follow-up list, contacted sorted last
  const followUpIds = new Set(followUpCustomers.map(c => c.id));

  // Group by priority tier (include ALL active customers, not just overdue)
  const priorityGroups: Record<number, Customer[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  customers
    .filter(c => c.activeStatus && !followUpIds.has(c.id))
    .forEach(c => {
      const tier = Math.min(c.priorityTier, 5) as 1 | 2 | 3 | 4 | 5;
      priorityGroups[tier].push(c);
    });

  // Sort each group: overdue (30+ days) first by most overdue, then contacted at bottom
  Object.values(priorityGroups).forEach(group =>
    group.sort((a, b) => {
      const da = effectiveDaysAgo(a);
      const db = effectiveDaysAgo(b);
      const aContacted = da < 30;
      const bContacted = db < 30;
      if (aContacted !== bContacted) return aContacted ? 1 : -1; // contacted go last
      return db - da; // most overdue first within each section
    })
  );

  const totalQueue = Object.values(priorityGroups).reduce((s, g) => s + g.filter(c => effectiveDaysAgo(c) >= 30).length, 0);

  // ── This week stats ────────────────────────────────────────────
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  const thisWeek = activities.filter(a => new Date(a.date) >= weekStart && (!myName || a.repName === myName));
  const weekCalls = thisWeek.filter(a => a.type === 'call').length;
  const weekEmails = thisWeek.filter(a => a.type === 'email').length;
  const weekNotes = thisWeek.filter(a => a.type === 'note').length;
  const weekTotal = thisWeek.length;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      <AssignmentAlert />

      {/* Greeting */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-bold text-gray-900">Hey {currentUser?.name?.split(' ')[0]} 👋</p>
          <p className="text-xs text-gray-400">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        {notifyTasks.length > 0 && (
          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
            {notifyTasks.length} task{notifyTasks.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setMainTab('queue')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${mainTab === 'queue' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          <Phone size={12} /> Call Queue
        </button>
        <button
          onClick={() => setMainTab('tasks')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${mainTab === 'tasks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          <ListChecks size={12} /> My Tasks
          {notifyTasks.length > 0 && <span className="w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{notifyTasks.length}</span>}
        </button>
      </div>

      {/* ── Tasks tab ─────────────────────────────────────────────── */}
      {mainTab === 'tasks' && (
        <div className="space-y-4">
          {notifyTasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No tasks yet</p>
              <p className="text-xs text-gray-400 mt-1">Tasks appear when you check "Notify rep" while logging an activity.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifyTasks.map(t => (
                <div key={t.id} className="bg-white rounded-2xl border border-amber-200 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{resolveCustomerName(t.customerId)}</p>
                      <p className="text-[10px] text-gray-400">{safeFormat(t.date, 'MMM d, yyyy · h:mm a')}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase flex-shrink-0">{t.type}</span>
                  </div>
                  {t.summary && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{t.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Call Queue tab ────────────────────────────────────────── */}
      {mainTab === 'queue' && <>

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-black text-gray-900">{calledToday.length}</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <CheckCircle size={11} className="text-green-500" />
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Logged Today</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-black text-amber-600">{followUpCustomers.length}</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Clock size={11} className="text-amber-500" />
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Follow-ups</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-black text-red-500">{totalQueue}</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <AlertCircle size={11} className="text-red-400" />
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">In Queue</p>
          </div>
        </div>
      </div>

      {/* Follow-ups section */}
      {followUpCustomers.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-600" />
              <p className="text-xs font-black text-amber-700 uppercase tracking-wider">Follow-ups Due</p>
            </div>
            <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
              {followUpCustomers.length}
            </span>
          </div>
          <div className="p-3 space-y-2">
            {followUpCustomers.map(c => (
              <CallerCard
                key={c.id}
                customer={c}
                daysAgo={effectiveDaysAgo(c)}
                followUpDate={followUpMap.get(c.id)}
                onOpen={() => setSelectedCustomer(c)}
                isFollowUp
              />
            ))}
          </div>
        </div>
      )}

      {/* Priority groups */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] px-1">
          Call Queue — No contact in 30+ days
        </p>

        {([1, 2, 3, 4, 5] as const).map(priority => {
          const group = priorityGroups[priority];
          if (group.length === 0) return null;
          const isExpanded = expandedPriority === priority;
          const style = TIER_STYLE[priority];
          const contactedCount = group.filter(c => effectiveDaysAgo(c) < 30).length;

          return (
            <div key={priority} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Priority header — tap to expand */}
              <button
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedPriority(isExpanded ? null : priority)}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${style.bg} ${style.text}`}>
                    Priority {priority}
                  </span>
                  <span className="text-xs text-gray-500">{group.length} accounts</span>
                  {priority === 1 && <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Highest</span>}
                </div>
                <div className="flex items-center gap-2">
                  {contactedCount > 0 && (
                    <span className="text-[10px] font-bold bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                      {contactedCount}/{group.length} contacted
                    </span>
                  )}
                  {isExpanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                </div>
              </button>

              {/* Accounts list */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-50">
                  <div className="pt-2 space-y-2">
                    {group.map(c => {
                      const days = effectiveDaysAgo(c);
                      return (
                        <CallerCard
                          key={c.id}
                          customer={c}
                          daysAgo={days}
                          onOpen={() => setSelectedCustomer(c)}
                          isFollowUp={false}
                          isContacted={days < 30}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {totalQueue === 0 && followUpCustomers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <CheckCircle size={32} className="text-green-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700">All accounts are up to date</p>
            <p className="text-xs text-gray-400 mt-1">No contacts overdue — great work!</p>
          </div>
        )}
      </div>

      {/* This week stats */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Your week so far</p>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-2xl font-black text-gray-900">{weekTotal}</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Total</p>
          </div>
          <div>
            <p className="text-2xl font-black text-blue-600">{weekCalls}</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Calls</p>
          </div>
          <div>
            <p className="text-2xl font-black text-purple-600">{weekEmails}</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Emails</p>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-500">{weekNotes}</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Notes</p>
          </div>
        </div>
      </div>

      </>}

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}
