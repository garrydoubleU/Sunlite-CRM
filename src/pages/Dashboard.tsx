import { useState, useEffect } from 'react';
import { Clock, ChevronDown, ChevronUp, Phone, Mail, TrendingUp, CheckSquare } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { calculateNextVisit, getDaysUntil, safeFormat, safeDaysSince } from '../utils/scheduler';
import RoutePlanner from '../components/RoutePlanner';
import CustomerModal from '../components/CustomerModal';
import AssignmentAlert from '../components/AssignmentAlert';
import CallerDashboard from './CallerDashboard';
import AdminDashboard from './AdminDashboard';
import OwnerDashboard from './OwnerDashboard';
import type { Customer } from '../types';

const TYPE_LABEL: Record<string, string> = { call: 'Phone Call', visit: 'Field Visit', email: 'Email', note: 'Note' };

export default function Dashboard() {
  const { customers, activities, csHandoffs, ackCSHandoff, addActivity, loadCSHandoffs } = useCustomerStore();
  const { currentUser } = useAuthStore();
  const role = currentUser?.role ?? 'field_sales';
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Refresh CS handoffs every time the dashboard mounts (catches handoffs created after login)
  useEffect(() => { loadCSHandoffs(); }, []);
  const [visitsOpen, setVisitsOpen] = useState(false);
  const [checkInsOpen, setCheckInsOpen] = useState(false);
  // Per-task completion note state: { [handoffId]: string }
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [taskExpanded, setTaskExpanded] = useState<Record<string, boolean>>({});

  if (role === 'owner') return <OwnerDashboard />;
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'inside_sales' || role === 'customer_service') return <CallerDashboard />;

  const now = new Date();
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ── Visits due (field accounts past their schedule) ────────────
  const visitsDue = customers
    .filter(c => c.activeStatus)
    .map(c => ({ c, next: calculateNextVisit(c.lastContactDate, c.visitFrequency, c.dayOfWeek) }))
    .filter(({ next }) => getDaysUntil(next) <= 0)
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .map(({ c }) => c);

  // ── Check-in needed ──
  const visitDueIds = new Set(visitsDue.map(c => c.id));
  const checkInsNeeded = customers
    .filter(c => c.activeStatus && !visitDueIds.has(c.id) && safeDaysSince(c.lastContactDate) >= 14)
    .sort((a, b) => safeDaysSince(b.lastContactDate) - safeDaysSince(a.lastContactDate));

  // ── Today stats ────────────────────────────────────────────────
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayActivities = activities.filter(a => new Date(a.date) >= todayStart);
  const callsToday = todayActivities.filter(a => a.type === 'call').length;
  const visitsToday = todayActivities.filter(a => a.type === 'visit').length;

  // ── This week stats ────────────────────────────────────────────
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  const thisWeekActivities = activities.filter(a => new Date(a.date) >= weekStart);
  const weekCalls = thisWeekActivities.filter(a => a.type === 'call').length;
  const weekVisits = thisWeekActivities.filter(a => a.type === 'visit').length;
  const weekEmails = thisWeekActivities.filter(a => a.type === 'email').length;
  const weekNotes = thisWeekActivities.filter(a => a.type === 'note').length;

  // ── Coming up soon (next 7–14 days) ──────────────────────────
  const comingSoon = customers
    .filter(c => c.activeStatus && !visitDueIds.has(c.id))
    .map(c => ({ c, next: calculateNextVisit(c.lastContactDate, c.visitFrequency, c.dayOfWeek) }))
    .filter(({ next }) => { const d = getDaysUntil(next); return d > 0 && d <= 14; })
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, 6);

  // ── Upcoming follow-ups ────────────────────────────────────────
  const upcomingFollowUps = activities
    .filter(a => a.followUpDate && new Date(a.followUpDate) >= now)
    .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())
    .slice(0, 6);

  const handleCompleteTask = (handoffId: string, customerId: string) => {
    const note = (taskNotes[handoffId] ?? '').trim();
    if (!note) return;
    // Log the rep's follow-up as an activity
    addActivity({
      id: `task_${Date.now()}`,
      customerId,
      type: 'note',
      date: new Date().toISOString(),
      repName: currentUser?.name ?? 'Unknown',
      summary: `[CS Task completed] ${note}`,
      source: 'manual',
    });
    ackCSHandoff(handoffId);
    setTaskNotes(p => { const n = { ...p }; delete n[handoffId]; return n; });
    setTaskExpanded(p => { const n = { ...p }; delete n[handoffId]; return n; });
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <AssignmentAlert />

      {/* ── Top stat strip ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Open Tasks', count: csHandoffs.length, color: csHandoffs.length > 0 ? 'text-amber-600' : 'text-gray-400', bg: csHandoffs.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100' },
          { label: 'Visits Today', count: visitsToday, color: 'text-green-600', bg: 'bg-white border-gray-100' },
          { label: 'Need Outreach', count: visitsDue.length + checkInsNeeded.length, color: visitsDue.length + checkInsNeeded.length > 0 ? 'text-red-500' : 'text-gray-400', bg: visitsDue.length + checkInsNeeded.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100' },
          { label: 'Calls Today', count: callsToday, color: 'text-blue-600', bg: 'bg-white border-gray-100' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`rounded-2xl border ${bg} p-3 text-center`}>
            <p className={`text-2xl font-black ${color}`}>{count}</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Greeting ───────────────────────────────────────── */}
      <div>
        <p className="text-xl font-bold text-gray-900">Good morning, {currentUser?.name?.split(' ')[0]}</p>
        <p className="text-sm text-gray-400 mt-0.5">{today}</p>
      </div>

      {/* ── Open Tasks (CS handoffs) ───────────────────────── */}
      {csHandoffs.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare size={14} className="text-amber-600" />
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Open Tasks</p>
            </div>
            <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">{csHandoffs.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {csHandoffs.map(h => {
              const label = TYPE_LABEL[h.activityType ?? 'note'] ?? 'Note';
              const dateStr = h.date ? new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
              const isExpanded = !!taskExpanded[h.id];
              const note = taskNotes[h.id] ?? '';
              return (
                <div key={h.id} className="p-4 space-y-2">
                  {/* Task header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button onClick={() => {
                        const c = customers.find(x => x.id === h.customerId || x.name.toLowerCase() === h.customerName.toLowerCase());
                        if (c) setSelectedCustomer(c);
                      }} className="text-sm font-bold text-gray-900 hover:text-amber-700 hover:underline text-left">{h.customerName}</button>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wide">{label}</span>
                        <span className="text-[10px] text-gray-400">{dateStr} · {h.csName}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setTaskExpanded(p => ({ ...p, [h.id]: !p[h.id] }))}
                      className="flex-shrink-0 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isExpanded ? 'Cancel' : 'Complete'}
                    </button>
                  </div>

                  {/* CS note */}
                  <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">{h.notes}</p>

                  {/* Complete with note */}
                  {isExpanded && (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={note}
                        onChange={e => setTaskNotes(p => ({ ...p, [h.id]: e.target.value }))}
                        placeholder="What did you do? (e.g. I called Nitin and he confirmed interest — will visit Thursday)"
                        rows={2}
                        autoFocus
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 outline-none resize-none focus:border-amber-400 transition-colors"
                      />
                      <button
                        onClick={() => handleCompleteTask(h.id, h.customerId)}
                        disabled={!note.trim()}
                        className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
                          note.trim() ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        Mark Complete & Log Note
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Key action cards ───────────────────────────────── */}

      {/* Visits due */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setVisitsOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <TrendingUp size={18} className="text-red-500" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-black text-gray-900 leading-none">{visitsDue.length}</p>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">Accounts need a visit</p>
            </div>
          </div>
          {visitsDue.length > 0 && (
            visitsOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
          )}
        </button>
        {visitsOpen && visitsDue.length > 0 && (
          <div className="border-t border-gray-50 px-4 pb-3 pt-2 space-y-2">
            {visitsDue.map(c => (
              <button key={c.id} onClick={() => setSelectedCustomer(c)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-red-50 transition-colors text-left">
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-black text-red-600">T{c.priorityTier}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{safeDaysSince(c.lastContactDate)}d since last contact</p>
                </div>
                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0">OVERDUE</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Check-ins needed */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setCheckInsOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Phone size={18} className="text-amber-500" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-black text-gray-900 leading-none">{checkInsNeeded.length}</p>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">Need a call or email check-in</p>
            </div>
          </div>
          {checkInsNeeded.length > 0 && (
            checkInsOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
          )}
        </button>
        {checkInsOpen && checkInsNeeded.length > 0 && (
          <div className="border-t border-gray-50 px-4 pb-3 pt-2 space-y-2">
            {checkInsNeeded.map(c => (
              <button key={c.id} onClick={() => setSelectedCustomer(c)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-amber-50 transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{safeDaysSince(c.lastContactDate)}d since last contact</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                      className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center text-green-600 hover:bg-green-200 transition-colors">
                      <Phone size={12} />
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                      className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 hover:bg-blue-200 transition-colors">
                      <Mail size={12} />
                    </a>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── This week stats ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Your week so far</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Visits', count: weekVisits, color: 'text-green-600' },
            { label: 'Calls', count: weekCalls, color: 'text-blue-600' },
            { label: 'Emails', count: weekEmails, color: 'text-purple-600' },
            { label: 'Notes', count: weekNotes, color: 'text-gray-500' },
          ].map(({ label, count, color }) => (
            <div key={label} className="text-center">
              <p className={`text-2xl font-black ${color}`}>{count}</p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Coming up soon ─────────────────────────────────── */}
      {comingSoon.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Coming up soon — get ahead</p>
          <div className="space-y-2">
            {comingSoon.map(({ c, next }) => {
              const days = getDaysUntil(next);
              return (
                <button key={c.id} onClick={() => setSelectedCustomer(c)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-amber-50 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">{safeFormat(next.toISOString(), 'EEE, MMM d')}</p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    in {days}d
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Upcoming follow-ups ─────────────────────────────── */}
      {upcomingFollowUps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-amber-500" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Upcoming Follow-ups</p>
          </div>
          <div className="space-y-2">
            {upcomingFollowUps.map(act => {
              const customer = customers.find(c =>
                c.id === act.customerId || c.name.toLowerCase() === act.customerId.toLowerCase()
              );
              const daysUntil = Math.ceil((new Date(act.followUpDate!).getTime() - now.getTime()) / 86400000);
              return (
                <button key={act.id} onClick={() => customer && setSelectedCustomer(customer)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800 truncate">{customer?.name ?? act.customerId}</p>
                    <p className="text-xs text-gray-500 truncate">{act.summary}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    daysUntil === 0 ? 'bg-red-100 text-red-600' :
                    daysUntil <= 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `IN ${daysUntil}D`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <RoutePlanner onOpenModal={setSelectedCustomer} />

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}
