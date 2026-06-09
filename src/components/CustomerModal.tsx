import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Mail, Calendar, Clock, Plus, ChevronDown, FileText, PhoneCall, Navigation, Star, Send, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Customer, ActivityType } from '../types';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { calculateNextVisit, getDueDateLabel, getDueDateColor, safeFormat, safeDaysSince, parseEmailSummary, looksLikeEmail } from '../utils/scheduler';

import { sendEmail, isGASConfigured } from '../api/sheets';
import { sendGmailMessage } from '../api/gmail';
import { useGmailStore } from '../store/gmailStore';
import { useSettingsStore } from '../store/settingsStore';
import GmailAuthButton from './GmailAuthButton';

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
  const { isTokenValid, accessToken, signature: gmailSig } = useGmailStore();
  const { signatures, getDefault } = useSettingsStore();
  const defaultSig = getDefault();
  // Prefer stored default signature, fall back to Gmail-fetched sig
  const signature = defaultSig?.body ?? gmailSig ?? null;
  const activities = getActivitiesForCustomer(customer.id);

  // Log form state
  const [notes, setNotes] = useState('');
  const [logType, setLogType] = useState<ActivityType>('call');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Email compose state
  const [showCompose, setShowCompose] = useState(false);
  const [emailTo, setEmailTo] = useState(customer.email ?? '');
  const [emailSubject, setEmailSubject] = useState('');
  const [selectedSigId, setSelectedSigId] = useState<string | null>(defaultSig?.id ?? null);
  const activeSig = signatures.find(s => s.id === selectedSigId)?.body ?? signature ?? null;
  const [emailBody, setEmailBody] = useState(activeSig ? `\n\n--\n${activeSig}` : '');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const hasGmailToken = isTokenValid();

  const nextVisit = calculateNextVisit(customer.lastContactDate, customer.visitFrequency, customer.dayOfWeek);
  const daysAgo = safeDaysSince(customer.lastContactDate);
  const tier = TIER_COLORS[customer.priorityTier];
  const showVisitSchedule = customer.visitFrequency === 'weekly' || customer.visitFrequency === 'biweekly';

  // Build quarterly revenue table: { year: { Q1, Q2, Q3, Q4 } }
  const revenueTable = useMemo(() => {
    const byYear: Record<string, { Q1: number; Q2: number; Q3: number; Q4: number; total: number }> = {};
    Object.entries(customer.revenueByQuarter ?? {}).forEach(([key, val]) => {
      const m = key.match(/^Q(\d)_(\d{4})$/);
      if (!m) return;
      const [, q, yr] = m;
      if (!byYear[yr]) byYear[yr] = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, total: 0 };
      byYear[yr][`Q${q}` as 'Q1'] = val;
      byYear[yr].total += val;
    });
    return Object.entries(byYear).sort(([a], [b]) => Number(a) - Number(b));
  }, [customer.revenueByQuarter]);

  const chartData = revenueTable.map(([yr, d]) => ({ year: yr, total: d.total }));
  const currentYear = new Date().getFullYear().toString();

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
      ...(followUp ? { followUpDate: new Date(followUp).toISOString() } : {}),
    });
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setNotes('');
    setFollowUp('');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    setEmailError('');
    try {
      if (hasGmailToken && accessToken) {
        // Send as the logged-in rep via Gmail API
        await sendGmailMessage({
          to: emailTo.trim(),
          subject: emailSubject.trim(),
          body: emailBody.trim(),
          fromName: currentUser?.name ?? '',
          fromEmail: currentUser?.email ?? '',
          accessToken,
        });
      } else if (isGASConfigured()) {
        // Fallback: send via GAS script owner's Gmail
        await sendEmail({
          to: emailTo.trim(),
          subject: emailSubject.trim(),
          body: emailBody.trim(),
          customerName: customer.name,
          customerId: customer.id,
          userEmail: currentUser?.email ?? '',
          repName: currentUser?.name ?? '',
        });
      }
      // Optimistic local activity log
      addActivity({
        id: `email_${Date.now()}`,
        customerId: customer.id,
        type: 'email',
        date: new Date().toISOString(),
        repName: currentUser?.name ?? 'Unknown',
        summary: `[Email sent] ${emailSubject}: ${emailBody.substring(0, 200)}`,
        source: 'manual',
      });
      setEmailSent(true);
      setEmailSubject('');
      setEmailBody(activeSig ? `\n\n--\n${activeSig}` : '');
      setTimeout(() => { setEmailSent(false); setShowCompose(false); }, 2000);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send email.');
    } finally {
      setEmailSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{maxWidth: '100vw'}}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full md:max-w-4xl bg-white md:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] rounded-t-2xl overflow-hidden" style={{maxWidth: '100vw'}}>

        {/* Header */}
        <div className="bg-[#0F2A4A] px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.15em]">Sunlite Account</span>
                <span className="text-[10px] text-blue-300">·</span>
                <span className="text-[10px] font-mono text-blue-300">{customer.id}</span>
              </div>
              <h2 className="text-lg md:text-2xl font-black text-white leading-tight break-words">{customer.name}</h2>
              <div className="flex flex-col gap-1 mt-1.5">
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-blue-200 text-xs hover:text-white">
                    <Phone size={11} className="flex-shrink-0" />
                    <span className="truncate">{customer.phone}</span>
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-blue-200 text-xs hover:text-white">
                    <Mail size={11} className="flex-shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mt-1">
              <button onClick={onClose} className="text-blue-300 hover:text-white transition-colors p-1">
                <X size={20} />
              </button>
            </div>
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
                {safeFormat(customer.lastContactDate, 'M/d/yyyy')}
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
          {/* Action bar */}
          {customer.email && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowCompose(!showCompose)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all w-full justify-center ${
                  showCompose
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-[#0F2A4A] hover:bg-amber-50'
                }`}
              >
                <Send size={15} />
                {showCompose ? 'Close Compose' : `Email ${customer.name.split(' ')[0]}`}
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto overflow-x-hidden">
          <div className="flex flex-col md:flex-row min-h-0 w-full">

            {/* Left column */}
            <div className="flex-1 min-w-0 p-4 md:p-5 space-y-5 md:border-r border-gray-100 overflow-hidden">

              {/* Field Visit Schedule — only for weekly/biweekly accounts */}
              {showVisitSchedule && <div>
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
                      defaultValue={safeFormat(customer.lastContactDate, 'yyyy-MM-dd', '')}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-amber-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Next visit preview */}
                <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-600">Next visit: <span className="font-bold text-gray-800">{safeFormat(nextVisit.toISOString(), 'EEE, MMM d yyyy')}</span></span>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${getDueDateColor(nextVisit)}`}>
                    {getDueDateLabel(nextVisit)}
                  </span>
                </div>
              </div>}

              {/* Compose Email */}
              {showCompose && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send size={13} className="text-amber-600" />
                      <p className="text-xs font-black text-amber-700 uppercase tracking-wider">New Email</p>
                    </div>
                    <button onClick={() => setShowCompose(false)} className="text-amber-400 hover:text-amber-600">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="p-3 space-y-2.5 bg-white">
                    {!hasGmailToken && (
                      <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-[10px] text-blue-600 font-semibold mb-2">Connect Gmail to send as yourself</p>
                        <GmailAuthButton />
                        <p className="text-[10px] text-blue-400 mt-1.5">Without connecting, email sends via the script account.</p>
                      </div>
                    )}
                    {hasGmailToken && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                        <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                        <p className="text-[10px] text-green-700 font-semibold">Sending as {currentUser?.email}</p>
                      </div>
                    )}
                    {signatures.length > 0 && (
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Signature</label>
                        <div className="relative">
                          <select
                            value={selectedSigId ?? ''}
                            onChange={e => {
                              const id = e.target.value || null;
                              setSelectedSigId(id);
                              const body = signatures.find(s => s.id === id)?.body ?? null;
                              // Swap signature block at bottom of compose body
                              setEmailBody(prev => {
                                const base = prev.replace(/\n\n--\n[\s\S]*$/, '');
                                return body ? `${base}\n\n--\n${body}` : base;
                              });
                            }}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none appearance-none focus:border-amber-400"
                          >
                            <option value="">No signature</option>
                            {signatures.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name}{s.isDefault ? ' (default)' : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">To</label>
                      <input
                        value={emailTo}
                        onChange={e => setEmailTo(e.target.value)}
                        placeholder="recipient@example.com"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Subject</label>
                      <input
                        value={emailSubject}
                        onChange={e => setEmailSubject(e.target.value)}
                        placeholder="Subject line..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Message</label>
                      <textarea
                        value={emailBody}
                        onChange={e => setEmailBody(e.target.value)}
                        placeholder="Write your message..."
                        rows={4}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none resize-none focus:border-amber-400"
                      />
                    </div>
                    {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                    <button
                      onClick={handleSendEmail}
                      disabled={!emailTo || !emailSubject || !emailBody || emailSending}
                      className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        emailSent ? 'bg-green-500 text-white' :
                        emailSending ? 'bg-gray-200 text-gray-400' :
                        emailTo && emailSubject && emailBody ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                        'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Send size={13} />
                      {emailSent ? 'Sent!' : emailSending ? 'Sending...' : 'Send Email'}
                    </button>
                    <p className="text-[10px] text-gray-400 text-center">
                      {hasGmailToken ? `Sends from ${currentUser?.email}` : 'Sends from script account'} · auto-logged
                    </p>
                  </div>
                </div>
              )}

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

              {/* Financial Performance */}
              {revenueTable.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Financial Performance</p>
                    <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Quarterly Breakdown
                    </span>
                  </div>

                  {/* Mobile: year cards stacked */}
                  <div className="md:hidden space-y-2 mb-4">
                    {revenueTable.map(([yr, d]) => (
                      <div key={yr} className={`rounded-xl border p-3 ${yr === currentYear ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-black text-gray-900">{yr}</span>
                          <span className="text-sm font-black text-amber-600">
                            ${d.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                            <div key={q} className="bg-white rounded-lg p-1.5 text-center border border-gray-100">
                              <p className="text-[9px] font-bold text-gray-400 uppercase">{q}</p>
                              <p className="text-[10px] font-bold text-gray-700 mt-0.5">
                                {d[q] > 0 ? `$${(d[q]/1000).toFixed(1)}k` : '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: full table */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-100 mb-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Year</th>
                          <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Q1</th>
                          <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Q2</th>
                          <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Q3</th>
                          <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Q4</th>
                          <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueTable.map(([yr, d]) => (
                          <tr key={yr} className="border-b border-gray-50 last:border-0">
                            <td className="px-3 py-2 font-black text-gray-900">{yr}</td>
                            {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                              <td key={q} className="px-3 py-2 text-right text-gray-600">
                                {d[q] > 0 ? `$${d[q].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0'}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right font-black text-amber-600">
                              ${d.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Bar chart */}
                  {chartData.length > 1 && (
                    <div className="bg-white rounded-xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black text-gray-800 uppercase tracking-wider">Revenue Growth</p>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Current</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0F2A4A] inline-block" /> Past</span>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={36} />
                          <Tooltip formatter={(v) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']} labelStyle={{ fontWeight: 700 }} />
                          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                            {chartData.map(d => (
                              <Cell key={d.year} fill={d.year === currentYear ? '#F59E0B' : '#0F2A4A'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right column — Recent Activity */}
            <div className="w-full md:w-72 min-w-0 p-4 md:p-5 bg-gray-50 flex-shrink-0 overflow-hidden">
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
                          <span className="text-[10px] text-gray-400">{safeFormat(activity.date, 'MMM d')}</span>
                        </div>
                        {(() => {
                          const isEmail = activity.type === 'email' || looksLikeEmail(activity.summary);
                          const email = isEmail ? parseEmailSummary(activity.summary) : null;
                          if (email) return (
                            <div className="mt-0.5 bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border-b border-gray-100">
                                {email.direction === 'sent'
                                  ? <ArrowUpRight size={9} className="text-blue-400 flex-shrink-0" />
                                  : <ArrowDownLeft size={9} className="text-green-500 flex-shrink-0" />}
                                <span className="text-[9px] font-bold text-gray-400 uppercase">
                                  {email.direction === 'sent' ? 'Sent' : 'Received'}
                                </span>
                                {email.address && <span className="text-[9px] text-gray-400 truncate">{email.address}</span>}
                              </div>
                              <div className="px-2 py-1">
                                <p className="text-[11px] font-semibold text-gray-800 leading-snug">{email.subject}</p>
                                {email.body && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{email.body}</p>}
                              </div>
                            </div>
                          );
                          return <p className="text-xs text-gray-700 leading-relaxed">{activity.summary}</p>;
                        })()}
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
    </div>,
    document.body
  );
}
