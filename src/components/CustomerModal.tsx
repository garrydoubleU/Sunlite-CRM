import { useState } from 'react';
import { X, MapPin, Phone, Mail, Calendar, Clock, Plus, ChevronDown, FileText, PhoneCall, Navigation, Star } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import type { Customer, ActivityType } from '../types';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { calculateNextVisit, getDueDateLabel, getDueDateColor } from '../utils/scheduler';
import { canViewRevenue } from '../utils/roleGate';

interface CustomerModalProps {
  customer: Customer;
  onClose: () => void;
}

const TIER_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-red-100', text: 'text-red-600', label: 'Level 1' },
  2: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Level 2' },
  3: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Level 3' },
  4: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Level 4' },
};

const TYPE_ICONS: Record<ActivityType, { icon: typeof FileText; color: string }> = {
  call:  { icon: PhoneCall,  color: 'text-blue-500 bg-blue-50' },
  visit: { icon: Navigation, color: 'text-green-500 bg-green-50' },
  note:  { icon: FileText,   color: 'text-gray-500 bg-gray-100' },
  email: { icon: Mail,       color: 'text-red-500 bg-red-50' },
};

const FREQ_OPTIONS = [
  { value: '',          label: 'No Scheduled Visits' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Bi-Weekly' },
  { value: 'monthly',   label: 'Monthly' },
];

export default function CustomerModal({ customer, onClose }: CustomerModalProps) {
  const { getActivitiesForCustomer, addActivity } = useCustomerStore();
  const { currentUser } = useAuthStore();
  const showRevenue = canViewRevenue(currentUser?.role ?? 'field_sales');
  const activities = getActivitiesForCustomer(customer.id);

  // Log form state
  const [notes, setNotes] = useState('');
  const [logType, setLogType] = useState<ActivityType>('call');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const nextVisit = calculateNextVisit(customer.lastContactDate, customer.visitFrequency, customer.dayOfWeek);
  const daysAgo = differenceInDays(new Date(), parseISO(customer.lastContactDate));
  const tier = TIER_COLORS[customer.priorityTier];

  const handleSave = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    addActivity({
      id: `a_${Date.now()}`,
      customerId: customer.id,
      type: logType,
      date: new Date().toISOString(),
      repName: currentUser?.name ?? 'Unknown',
      summary: notes.trim(),
      source: 'manual',
    });
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setNotes('');
    setFollowUp('');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full md:max-w-4xl bg-white md:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] rounded-t-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#0F2A4A] px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.15em]">Sunlite Account</span>
                <span className="text-[10px] text-blue-300">·</span>
                <span className="text-[10px] font-mono text-blue-300">{customer.id}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white leading-tight">{customer.name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {customer.billingAddress && (
                  <div className="flex items-center gap-1 text-blue-200 text-xs">
                    <MapPin size={11} />
                    <span>{customer.billingAddress}</span>
                  </div>
                )}
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-blue-200 text-xs hover:text-white">
                    <Phone size={11} />
                    <span>{customer.phone}</span>
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-blue-200 text-xs hover:text-white">
                    <Mail size={11} />
                    <span>{customer.email}</span>
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-blue-300 hover:text-white transition-colors p-1 flex-shrink-0 mt-1">
              <X size={20} />
            </button>
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <div className="bg-white/10 rounded-xl p-2.5">
              <p className="text-[9px] font-bold text-blue-300 uppercase tracking-wider mb-1">Priority Status</p>
              <div className="flex items-center gap-1.5">
                <Star size={12} className="text-amber-400" fill="currentColor" />
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>{tier.label}</span>
              </div>
              <p className="text-[10px] text-blue-200 mt-0.5 truncate">{customer.customerClass}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5">
              <p className="text-[9px] font-bold text-blue-300 uppercase tracking-wider mb-1">Last Activity</p>
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-blue-300" />
                <span className="text-xs font-bold text-white">{daysAgo}d ago</span>
              </div>
              <p className="text-[10px] text-blue-200 mt-0.5">
                {format(parseISO(customer.lastContactDate), 'M/d/yyyy')}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5">
              <p className="text-[9px] font-bold text-blue-300 uppercase tracking-wider mb-1">Open Orders</p>
              <p className="text-xl font-black text-white">{customer.openOrderCount}</p>
              <p className="text-[10px] text-blue-200 mt-0.5">{customer.visitFrequency}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5">
              <p className="text-[9px] font-bold text-blue-300 uppercase tracking-wider mb-1">Assigned Agent</p>
              <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white text-[10px] font-bold mb-0.5">
                {customer.assignedRepName.split(' ').map(n => n[0]).join('')}
              </div>
              <p className="text-[10px] text-blue-200 truncate">{customer.assignedRepName.split(' ')[0]} {customer.assignedRepName.split(' ')[1]?.[0]}.</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          <div className="flex flex-col md:flex-row min-h-0">

            {/* Left column */}
            <div className="flex-1 p-4 md:p-5 space-y-5 md:border-r border-gray-100">

              {/* Field Visit Schedule */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-amber-500" />
                    <p className="text-xs font-black text-gray-800 uppercase tracking-wider">Field Visit Schedule</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                    customer.visitFrequency !== 'monthly' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {customer.visitFrequency ? customer.visitFrequency : 'Unscheduled'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-3">Establish regular physical routing touches for this account.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Visit Frequency</label>
                    <div className="relative">
                      <select
                        value={customer.visitFrequency}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none appearance-none focus:border-amber-400 transition-colors"
                        onChange={() => {}}
                      >
                        {FREQ_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Route Commencement Date</label>
                    <input
                      type="date"
                      defaultValue={format(parseISO(customer.lastContactDate), 'yyyy-MM-dd')}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Next visit preview */}
                <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-600">Next visit: <span className="font-bold text-gray-800">{format(nextVisit, 'EEE, MMM d yyyy')}</span></span>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${getDueDateColor(nextVisit)}`}>
                    {getDueDateLabel(nextVisit)}
                  </span>
                </div>
              </div>

              {/* Log Quick Note */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Plus size={15} className="text-amber-500" />
                  <p className="text-xs font-black text-gray-800 uppercase tracking-wider">Log Quick Note</p>
                </div>
                <p className="text-xs text-gray-400 mb-3">Record a new interaction or update account status.</p>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="What was discussed?"
                      rows={3}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none resize-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Type</label>
                      <div className="relative">
                        <select
                          value={logType}
                          onChange={e => setLogType(e.target.value as ActivityType)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none appearance-none focus:border-amber-400 transition-colors"
                        >
                          <option value="call">Phone Call</option>
                          <option value="visit">Field Visit</option>
                          <option value="email">Email</option>
                          <option value="note">Note</option>
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Follow Up</label>
                      <input
                        type="date"
                        value={followUp}
                        onChange={e => setFollowUp(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={!notes.trim() || saving}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                      saved ? 'bg-green-500 text-white' :
                      saving ? 'bg-gray-200 text-gray-400' :
                      notes.trim() ? 'bg-[#0F2A4A] hover:bg-[#1a3a5c] text-white' :
                      'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Update Hub Record'}
                  </button>
                  <p className="text-[10px] text-gray-400 text-center">
                    Changes sync to the master record and activity log automatically.
                  </p>
                </div>
              </div>

              {/* Financial Performance (admin only) */}
              {showRevenue && customer.revenue > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Financial Performance</p>
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-700">Annual Revenue</span>
                      <span className="text-sm font-black text-gray-900">${customer.revenue.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (customer.revenue / 600000) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">vs $600k top account</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right column — Recent Activity */}
            <div className="w-full md:w-72 p-4 md:p-5 bg-gray-50 flex-shrink-0">
              <p className="text-xs font-black text-gray-800 uppercase tracking-wider mb-1">Recent Activity</p>
              <p className="text-[10px] text-gray-400 mb-4">Complete interaction timeline for this account.</p>

              <div className="space-y-3 max-h-80 md:max-h-[420px] overflow-y-auto pr-1">
                {activities.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-400">No activity logged yet.</p>
                  </div>
                )}
                {activities.map(activity => {
                  const { icon: Icon, color } = TYPE_ICONS[activity.type];
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">{activity.type}</span>
                          <span className="text-[10px] text-gray-400">{format(parseISO(activity.date), 'MMM d')}</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">{activity.summary}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{activity.repName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
