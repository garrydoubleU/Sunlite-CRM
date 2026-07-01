import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Mail, Clock, Plus, ChevronDown, FileText, PhoneCall, Navigation, Send, ArrowUpRight, ArrowDownLeft, Lock, UserPlus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Customer, Contact, ActivityType, SalesRep, CSHandoff } from '../types';
import { useCustomerStore, ownsAccount } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { calculateNextVisit, getDueDateLabel, getDueDateColor, safeFormat, safeDaysSince, parseEmailSummary, looksLikeEmail } from '../utils/scheduler';

import { sendEmail, isGASConfigured, updateCustomerEmail, fetchUsers, addContactToSheet } from '../api/sheets';
import { sendGmailMessage } from '../api/gmail';
import { useGmailStore } from '../store/gmailStore';
import { useSettingsStore } from '../store/settingsStore';
import GmailAuthButton from './GmailAuthButton';

interface CustomerModalProps {
  customer: Customer;
  onClose: () => void;
  task?: CSHandoff; // optional CS task to complete alongside logging
}

function parseContacts(emailField: string): Contact[] {
  if (!emailField) return [];
  try {
    const p = JSON.parse(emailField);
    if (Array.isArray(p)) return p.map(c => typeof c === 'string' ? { email: c } : c as Contact);
  } catch {}
  return emailField.split(',').map(e => e.trim()).filter(Boolean).map(email => ({ email }));
}

function contactLabel(c: Contact): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return name ? `${name}${c.position ? ` · ${c.position}` : ''}` : c.email;
}

const TIER_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-red-100', text: 'text-red-600', label: 'Level 1' },
  2: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Level 2' },
  3: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Level 3' },
  4: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Level 4' },
};


const FREQ_OPTIONS = [
  { value: '',          label: 'No Scheduled Visits' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Bi-Weekly' },
  { value: 'monthly',   label: 'Monthly' },
];

export default function CustomerModal({ customer, onClose, task }: CustomerModalProps) {
  const { getActivitiesForCustomer, addActivity, updateCustomer, assignAccount, requestAccess, ackCSHandoff } = useCustomerStore();
  const { currentUser } = useAuthStore();

  const myEmail = currentUser?.email ?? '';
  const role = currentUser?.role ?? 'field_sales';
  // Field reps get a read-only view of accounts outside their own book:
  // contact info + log a note, no history/revenue/schedule.
  const restricted = role === 'field_sales' && !ownsAccount(customer, myEmail);
  // Call-center staff, admins and owners can reassign accounts to a rep.
  const isOwner = role === 'owner';
  const canAssign = !isOwner && (role === 'admin' || role === 'inside_sales' || role === 'customer_service');

  // Assignment panel state
  const [showAssign, setShowAssign] = useState(false);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [assignTo, setAssignTo] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignedDone, setAssignedDone] = useState(false);
  useEffect(() => {
    if (showAssign && reps.length === 0 && isGASConfigured()) {
      fetchUsers()
        .then(us => setReps(us.filter(u => u.role === 'field_sales' || u.role === 'inside_sales')))
        .catch(() => {});
    }
  }, [showAssign, reps.length]);

  const handleAssign = async () => {
    const rep = reps.find(r => r.email === assignTo);
    if (!rep) return;
    setAssigning(true);
    await assignAccount(customer, rep.email, rep.name);
    setAssigning(false);
    setAssignedDone(true);
    setTimeout(() => { setAssignedDone(false); setShowAssign(false); }, 1800);
  };

  // House account: inside_sales sees a "Request Account" button
  const isHouseAccount = (customer.customerClass || '').toLowerCase().includes('house');
  const canRequestAccount = role === 'inside_sales' && isHouseAccount;

  // Request-access state (restricted field reps + inside_sales on house accounts)
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const handleRequestAccess = async () => {
    setRequesting(true);
    await requestAccess(customer);
    setRequesting(false);
    setRequested(true);
  };
  const { isTokenValid, accessToken, signature: gmailSig } = useGmailStore();
  const { signatures, getDefault } = useSettingsStore();
  const defaultSig = getDefault();
  // Prefer stored default signature, fall back to Gmail-fetched sig
  const signature = defaultSig?.body ?? gmailSig ?? null;
  const activities = getActivitiesForCustomer(customer.id);
  const myName = currentUser?.name ?? '';

  // Restricted mode: build a name→role map so we can tell CS notes from other reps' notes
  const [userRoleMap, setUserRoleMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (restricted && isGASConfigured()) {
      fetchUsers()
        .then(us => {
          const m: Record<string, string> = {};
          us.forEach(u => {
            if (!u.name) return;
            const full = u.name.toLowerCase().trim();
            m[full] = u.role;
            // Also index by first name so a log by "Leah" matches user "Leah Cohen"
            const first = full.split(/\s+/)[0];
            if (first && !(first in m)) m[first] = u.role;
            // And by email / email prefix
            if (u.email) {
              m[u.email.toLowerCase().trim()] = u.role;
              m[u.email.toLowerCase().split('@')[0]] = u.role;
            }
          });
          setUserRoleMap(m);
        })
        .catch(() => {});
    }
  }, [restricted]);

  const roleOf   = (repName?: string) => userRoleMap[(repName || '').toLowerCase().trim()] || '';
  const isMine   = (a: { repName?: string }) => (a.repName || '').toLowerCase().trim() === myName.toLowerCase().trim();
  const isCSNote = (a: { repName?: string }) => roleOf(a.repName) === 'customer_service';

  // In restricted mode reps see: their own notes + CS notes. Other reps' notes collapse into a banner.
  const displayActivities = restricted ? activities.filter(a => isMine(a) || isCSNote(a)) : activities;
  const otherRepActivities = restricted ? activities.filter(a => !isMine(a) && !isCSNote(a)) : [];

  // Group other reps' activity → { name → most recent date }
  const otherRepTouch: { name: string; date: string }[] = [];
  if (restricted && otherRepActivities.length > 0) {
    const byName: Record<string, string> = {};
    otherRepActivities.forEach(a => {
      const n = a.repName || 'Another rep';
      if (!byName[n] || new Date(a.date) > new Date(byName[n])) byName[n] = a.date;
    });
    Object.entries(byName).forEach(([name, date]) => otherRepTouch.push({ name, date }));
    otherRepTouch.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());
  }

  // Log form state
  const [notes, setNotes] = useState('');
  const [logType, setLogType] = useState<ActivityType | ''>('');
  const [followUp, setFollowUp] = useState('');
  const [notifyRep, setNotifyRep] = useState(false);
  const [completeTask, setCompleteTask] = useState(!!task);
  const [gasDebug, setGasDebug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Multi-contact state
  const [contacts, setContacts] = useState<Contact[]>(parseContacts(customer.email ?? ''));
  const [addingContact, setAddingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [newContact, setNewContact] = useState<Contact>({ email: '', firstName: '', lastName: '', position: '', phone: '', ext: '' });

  const persistContacts = async (list: Contact[]) => {
    const serialized = JSON.stringify(list);
    updateCustomer(customer.id, { email: serialized });
    if (isGASConfigured()) {
      await updateCustomerEmail(customer.id, serialized).catch(() => {});
    }
  };

  const handleAddContact = async () => {
    if (!newContact.email.trim()) return;
    setSavingContact(true);
    const entry: Contact = {
      email: newContact.email.trim(),
      ...(newContact.firstName?.trim() ? { firstName: newContact.firstName.trim() } : {}),
      ...(newContact.lastName?.trim() ? { lastName: newContact.lastName.trim() } : {}),
      ...(newContact.position?.trim() ? { position: newContact.position.trim() } : {}),
      ...(newContact.phone?.trim() ? { phone: newContact.phone.trim() } : {}),
      ...(newContact.ext?.trim() ? { ext: newContact.ext.trim() } : {}),
    };
    const next = [...contacts.filter(c => c.email !== entry.email), entry];
    setContacts(next);
    await persistContacts(next);
    if (isGASConfigured()) {
      const { currentUser } = useAuthStore.getState();
      addContactToSheet({
        customerId: customer.id,
        customerName: customer.name,
        firstName: entry.firstName,
        lastName: entry.lastName,
        position: entry.position,
        contactEmail: entry.email,
        addedBy: currentUser?.email ?? '',
      }).catch(() => {});
    }
    setSavingContact(false);
    setNewContact({ email: '', firstName: '', lastName: '', position: '', phone: '', ext: '' });
    setAddingContact(false);
    if (!emailTo) setEmailTo(entry.email);
  };

  const handleRemoveContact = async (email: string) => {
    const next = contacts.filter(c => c.email !== email);
    setContacts(next);
    await persistContacts(next);
    if (emailTo === email) setEmailTo(next[0]?.email ?? '');
  };

  // Email compose state
  const [showCompose, setShowCompose] = useState(false);
  const [emailTo, setEmailTo] = useState(parseContacts(customer.email ?? '')[0]?.email ?? '');
  const [emailSubject, setEmailSubject] = useState('');
  const [selectedSigId, setSelectedSigId] = useState<string | null>(defaultSig?.id ?? null);
  const activeSig = signatures.find(s => s.id === selectedSigId)?.body ?? signature ?? null;
  const [emailBody, setEmailBody] = useState(activeSig ? `\n\n--\n${activeSig}` : '');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const hasGmailToken = isTokenValid();

  const daysAgo = safeDaysSince(customer.lastContactDate);
  const tier = TIER_COLORS[customer.priorityTier];
  // Editable visit schedule
  const [schedFreq, setSchedFreq] = useState<'weekly' | 'biweekly' | 'monthly' | ''>(customer.visitFrequency ?? '');
  const [schedDate, setSchedDate] = useState(safeFormat(customer.lastContactDate, 'yyyy-MM-dd', ''));
  const schedChanged = schedFreq !== (customer.visitFrequency ?? '') || schedDate !== safeFormat(customer.lastContactDate, 'yyyy-MM-dd', '');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savedSchedule, setSavedSchedule] = useState(false);

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    updateCustomer(customer.id, { visitFrequency: schedFreq as Customer['visitFrequency'] });
    await new Promise(r => setTimeout(r, 500));
    setSavingSchedule(false);
    setSavedSchedule(true);
    setTimeout(() => setSavedSchedule(false), 2000);
  };

  const previewVisit = schedFreq ? calculateNextVisit(schedDate || customer.lastContactDate, schedFreq as Customer['visitFrequency'], customer.dayOfWeek) : null;

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
    const effectiveType: ActivityType | '' = restricted ? 'note' : logType;
    if (!notes.trim() || !effectiveType) return;
    setSaving(true);
    setGasDebug(null);
    const result = await addActivity({
      id: `a_${Date.now()}`,
      customerId: customer.id,
      type: effectiveType,
      date: new Date().toISOString(),
      repName: currentUser?.name ?? 'Unknown',
      summary: notes.trim(),
      source: 'manual',
      notifyRep,
      ...(followUp ? { followUpDate: new Date(followUp).toISOString() } : {}),
    });
    setSaving(false);
    setSaved(true);
    if (notifyRep) setGasDebug(JSON.stringify(result, null, 2));
    // Complete the CS task if checkbox is checked
    if (task && completeTask) ackCSHandoff(task.id, notes.trim());
    setNotes('');
    setLogType('');
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

  const [tab, setTab] = useState<'activity' | 'schedule' | 'revenue'>('activity');

  const TABS = restricted
    ? [{ id: 'activity' as const, label: 'Log Note' }]
    : isOwner
    ? [
        { id: 'activity' as const, label: 'Activity' },
        { id: 'revenue' as const, label: 'Revenue' },
      ]
    : [
        { id: 'activity' as const, label: 'Activity' },
        { id: 'schedule' as const, label: 'Schedule' },
        { id: 'revenue' as const, label: 'Revenue' },
      ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full md:max-w-lg bg-white md:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[88vh] rounded-t-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="bg-[#0F2A4A] px-4 py-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Sunlite</span>
                <span className="text-[9px] text-blue-400">·</span>
                <span className="text-[9px] font-mono text-blue-400">{customer.id}</span>
                {!customer.activeStatus && <span className="text-[9px] font-bold bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded">Inactive</span>}
              </div>
              <h2 className="text-xl font-black text-white leading-tight">{customer.name}</h2>

              {/* Contact row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-blue-200 text-xs hover:text-white">
                    <Phone size={10} />
                    {customer.phone}
                  </a>
                )}
                {contacts.map(c => (
                  <div key={c.email} className="flex items-center gap-1 group">
                    <button onClick={() => { setEmailTo(c.email); setTab('activity'); setShowCompose(true); }} className="flex items-center gap-1 text-blue-200 text-xs hover:text-amber-300 transition-colors">
                      <Mail size={10} />
                      <span className="max-w-[200px] truncate">{contactLabel(c)}</span>
                    </button>
                    <button onClick={() => handleRemoveContact(c.email)} className="text-blue-400/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <X size={9} />
                    </button>
                  </div>
                ))}
                {addingContact ? (
                  <div className="mt-1 bg-white/5 rounded-lg p-2 border border-white/10 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1">
                      <input value={newContact.firstName ?? ''} onChange={e => setNewContact(p => ({...p, firstName: e.target.value}))} placeholder="First name" className="bg-white/10 text-white text-xs rounded-md px-2 py-1 outline-none border border-white/20 focus:border-amber-400 placeholder-blue-300/50" />
                      <input value={newContact.lastName ?? ''} onChange={e => setNewContact(p => ({...p, lastName: e.target.value}))} placeholder="Last name" className="bg-white/10 text-white text-xs rounded-md px-2 py-1 outline-none border border-white/20 focus:border-amber-400 placeholder-blue-300/50" />
                    </div>
                    <input value={newContact.position ?? ''} onChange={e => setNewContact(p => ({...p, position: e.target.value}))} placeholder="Position (e.g. Buyer, Owner)" className="w-full bg-white/10 text-white text-xs rounded-md px-2 py-1 outline-none border border-white/20 focus:border-amber-400 placeholder-blue-300/50" />
                    <div className="grid grid-cols-3 gap-1">
                      <input value={newContact.phone ?? ''} onChange={e => setNewContact(p => ({...p, phone: e.target.value}))} placeholder="Phone" className="col-span-2 bg-white/10 text-white text-xs rounded-md px-2 py-1 outline-none border border-white/20 focus:border-amber-400 placeholder-blue-300/50" />
                      <input value={newContact.ext ?? ''} onChange={e => setNewContact(p => ({...p, ext: e.target.value}))} placeholder="Ext." className="bg-white/10 text-white text-xs rounded-md px-2 py-1 outline-none border border-white/20 focus:border-amber-400 placeholder-blue-300/50" />
                    </div>
                    <input
                      value={newContact.email}
                      onChange={e => setNewContact(p => ({...p, email: e.target.value}))}
                      placeholder="Email address *"
                      autoFocus
                      className="w-full bg-white/10 text-white text-xs rounded-md px-2 py-1 outline-none border border-white/20 focus:border-amber-400 placeholder-blue-300/50"
                      onKeyDown={e => { if (e.key === 'Enter') handleAddContact(); if (e.key === 'Escape') setAddingContact(false); }}
                    />
                    <div className="flex gap-1">
                      <button onClick={handleAddContact} disabled={savingContact || !newContact.email.trim()} className="flex-1 text-[10px] font-bold bg-amber-500 disabled:bg-gray-600 text-white px-2 py-1 rounded-md transition-colors">
                        {savingContact ? 'Saving…' : 'Save Contact'}
                      </button>
                      <button onClick={() => setAddingContact(false)} className="text-blue-300 hover:text-white px-2"><X size={11} /></button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingContact(true)} className="flex items-center gap-0.5 text-[10px] text-amber-400 hover:text-amber-300 transition-colors">
                    <Plus size={9} />
                    {contacts.length === 0 ? 'Add email' : 'Add contact'}
                  </button>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-blue-300 hover:text-white p-1 flex-shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Stat strip */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>{tier.label}</span>
            {customer.customerClass && <span className="text-[10px] text-blue-300">{customer.customerClass}</span>}
            {(customer.city || customer.state) && (
              <>
                <span className="text-[10px] text-blue-400">·</span>
                <span className="text-[10px] text-blue-200">
                  {[customer.city, customer.state].filter(Boolean).join(', ')}
                </span>
              </>
            )}
            <span className="text-[10px] text-blue-400">·</span>
            <span className="text-[10px] text-blue-200 flex items-center gap-1">
              <Clock size={9} />
              Last contacted: <span className="font-bold text-white ml-0.5">{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
            </span>
            <span className="text-[10px] text-blue-400">·</span>
            <span className="text-[10px] text-blue-200">{customer.openOrderCount} open order{customer.openOrderCount !== 1 ? 's' : ''}</span>
            <span className="text-[10px] text-blue-400">·</span>
            <span className="text-[10px] text-blue-200 flex items-center gap-1">
              {customer.customerClass ? (
                <span className="bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                  {customer.customerClass}
                </span>
              ) : null}
              {customer.assignedRepName.split(' ')[0]}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {/* Email button — hidden for restricted reps and owner */}
            {!restricted && !isOwner && contacts.length > 0 && (
              <button
                onClick={() => { setTab('activity'); setShowCompose(!showCompose); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all flex-1 justify-center ${
                  showCompose ? 'bg-amber-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Send size={12} />
                {showCompose ? 'Close Compose' : `Email ${customer.name.split(' ')[0]}`}
              </button>
            )}
            {/* Assign button — call center / admin / owner */}
            {canAssign && (
              <button
                onClick={() => setShowAssign(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all flex-1 justify-center ${
                  showAssign ? 'bg-amber-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <UserPlus size={12} />
                Assign
              </button>
            )}
          </div>

          {/* Assign panel */}
          {canAssign && showAssign && (
            <div className="mt-2 bg-white/5 rounded-xl p-2.5 border border-white/10 space-y-2">
              <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Reassign account</p>
              <div className="relative">
                <select
                  value={assignTo}
                  onChange={e => setAssignTo(e.target.value)}
                  className="w-full bg-white/10 text-white text-xs rounded-md px-2 py-1.5 outline-none border border-white/20 focus:border-amber-400 appearance-none"
                >
                  <option value="" className="text-gray-800">Select a rep…</option>
                  {reps.map(r => <option key={r.email} value={r.email} className="text-gray-800">{r.name} ({r.email})</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-300 pointer-events-none" />
              </div>
              <button
                onClick={handleAssign}
                disabled={!assignTo || assigning}
                className={`w-full text-[11px] font-bold py-1.5 rounded-md transition-colors ${
                  assignedDone ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white'
                }`}
              >
                {assignedDone ? '✓ Assigned & rep notified' : assigning ? 'Assigning…' : 'Assign to rep'}
              </button>
            </div>
          )}
        </div>

        {/* ── Tab bar ─────────────────────────────────────────── */}
        <div className="flex border-b border-gray-100 bg-white flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                tab === t.id
                  ? 'text-[#0F2A4A] border-b-2 border-[#0F2A4A]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Activity tab */}
          {tab === 'activity' && (
            <div className="p-4 space-y-4">

              {/* Restricted-access banner for reps outside their book */}
              {restricted && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock size={13} className="text-amber-600" />
                    <p className="text-[11px] font-black text-amber-700 uppercase tracking-wider">Not your account</p>
                  </div>
                  <p className="text-[11px] text-amber-700/80 leading-relaxed">
                    This account is assigned to {customer.assignedRepName || 'another rep'}. You can log a note and see your own notes, but not its full history or sales. Request access for the complete record.
                  </p>
                  <button
                    onClick={handleRequestAccess}
                    disabled={requesting || requested}
                    className={`mt-2 w-full text-[11px] font-bold py-1.5 rounded-lg transition-colors ${
                      requested ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white'
                    }`}
                  >
                    {requested ? '✓ Access requested — admin notified' : requesting ? 'Sending…' : 'Request access'}
                  </button>
                </div>
              )}

              {/* House account banner for inside_sales */}
              {canRequestAccount && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[11px] font-black text-blue-700 uppercase tracking-wider">House Account</p>
                  </div>
                  <p className="text-[11px] text-blue-700/80 leading-relaxed">
                    This is a house account. Request it to have it assigned to you in the system.
                  </p>
                  <button
                    onClick={handleRequestAccess}
                    disabled={requesting || requested}
                    className={`mt-2 w-full text-[11px] font-bold py-1.5 rounded-lg transition-colors ${
                      requested ? 'bg-green-500 text-white' : 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white'
                    }`}
                  >
                    {requested ? '✓ Request sent — admin notified' : requesting ? 'Sending…' : 'Request Account'}
                  </button>
                </div>
              )}

              {/* Compose */}
              {showCompose && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send size={12} className="text-amber-600" />
                      <p className="text-xs font-black text-amber-700 uppercase tracking-wider">New Email</p>
                    </div>
                    <button onClick={() => setShowCompose(false)} className="text-amber-400 hover:text-amber-600"><X size={13} /></button>
                  </div>
                  <div className="p-3 space-y-2 bg-white">
                    {!hasGmailToken ? (
                      <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-[10px] text-blue-600 font-semibold mb-2">Connect Gmail to send as yourself</p>
                        <GmailAuthButton />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-1.5 bg-green-50 rounded-lg border border-green-100">
                        <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                        <p className="text-[10px] text-green-700 font-semibold">Sending as {currentUser?.email}</p>
                      </div>
                    )}
                    {signatures.length > 0 && (
                      <div className="relative">
                        <select
                          value={selectedSigId ?? ''}
                          onChange={e => {
                            const id = e.target.value || null;
                            setSelectedSigId(id);
                            const body = signatures.find(s => s.id === id)?.body ?? null;
                            setEmailBody(prev => {
                              const base = prev.replace(/\n\n--\n[\s\S]*$/, '');
                              return body ? `${base}\n\n--\n${body}` : base;
                            });
                          }}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none appearance-none focus:border-amber-400"
                        >
                          <option value="">No signature</option>
                          {signatures.map(s => <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' (default)' : ''}</option>)}
                        </select>
                        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    )}
                    <div className="relative">
                      {contacts.length > 1 ? (
                        <>
                          <select value={emailTo} onChange={e => setEmailTo(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none appearance-none focus:border-amber-400">
                            {contacts.map(c => <option key={c.email} value={c.email}>{contactLabel(c)} — {c.email}</option>)}
                          </select>
                          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </>
                      ) : (
                        <input value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="To: recipient@example.com" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-amber-400" />
                      )}
                    </div>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Subject" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-amber-400" />
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Message..." rows={4} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none resize-none focus:border-amber-400" />
                    {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                    <button
                      onClick={handleSendEmail}
                      disabled={!emailTo || !emailSubject || !emailBody || emailSending}
                      className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        emailSent ? 'bg-green-500 text-white' :
                        emailSending ? 'bg-gray-200 text-gray-400' :
                        emailTo && emailSubject && emailBody ? 'bg-amber-500 hover:bg-amber-600 text-white' :
                        'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Send size={12} />
                      {emailSent ? 'Sent!' : emailSending ? 'Sending...' : 'Send Email'}
                    </button>
                  </div>
                </div>
              )}

              {/* CS Task banner — shown when modal opened from a task */}
              {task && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">CS Task from {task.csName}</p>
                    <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded uppercase">{task.activityType}</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">{task.notes}</p>
                  <p className="text-[10px] text-amber-600">{safeFormat(task.date, 'MMM d, yyyy · h:mm a')}</p>
                </div>
              )}

              {/* Log form — hidden for owner */}
              {role !== 'owner' && <div className="space-y-2">
                <p className="text-[11px] font-black text-gray-700 uppercase tracking-wider">Log Activity</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="What was discussed?"
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-700 outline-none resize-none focus:border-amber-400 transition-colors"
                />
                {(currentUser?.role === 'customer_service' || currentUser?.role === 'inside_sales') && (() => {
                  const hasRep = !!(customer.assignedRepId && customer.assignedRepId.trim() && customer.assignedRepId.includes('@'));
                  return (
                    <label className={`flex items-center gap-2 text-xs ${hasRep ? 'text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}>
                      <input
                        type="checkbox"
                        checked={notifyRep}
                        disabled={!hasRep}
                        onChange={e => setNotifyRep(e.target.checked)}
                        className="rounded disabled:opacity-40"
                      />
                      <span>Notify assigned rep to follow up{!hasRep ? ' (no rep assigned)' : ''}</span>
                    </label>
                  );
                })()}
                {restricted ? (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                    <FileText size={11} className="text-gray-400" />
                    <span className="text-xs text-gray-500">Logged as a note</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select value={logType} onChange={e => setLogType(e.target.value as ActivityType | '')} className={`w-full bg-gray-50 border rounded-lg px-2.5 py-1.5 text-xs outline-none appearance-none focus:border-amber-400 ${logType ? 'border-gray-200 text-gray-700' : 'border-amber-300 text-gray-400'}`}>
                        <option value="" disabled>Select type…</option>
                        <option value="call">Phone Call</option>
                        <option value="visit">Field Visit</option>
                        <option value="email">Email</option>
                        <option value="note">Note</option>
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="flex-1 relative">
                      <label className="absolute -top-4 left-0 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Follow-up date</label>
                      <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-amber-400" />
                    </div>
                  </div>
                )}
                {task && (
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={completeTask}
                      onChange={e => setCompleteTask(e.target.checked)}
                      className="rounded"
                    />
                    <span>Mark CS task complete when saving</span>
                  </label>
                )}
                <button
                  onClick={handleSave}
                  disabled={!notes.trim() || (!restricted && !logType) || saving}
                  className={`w-full py-2 rounded-lg font-bold text-xs transition-all ${
                    saved ? 'bg-green-500 text-white' :
                    saving ? 'bg-gray-200 text-gray-400' :
                    notes.trim() && (restricted || logType) ? 'bg-[#0F2A4A] hover:bg-[#1a3a5c] text-white' :
                    'bg-gray-100 text-gray-400'
                  }`}
                >
                  {saved ? '✓ Saved' : saving ? 'Saving…' : !restricted && !logType && notes.trim() ? 'Pick a type to save' : task && completeTask ? 'Save & Complete Task' : 'Save Activity'}
                </button>
                {gasDebug && (
                  <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">GAS Response (notify debug)</p>
                    <pre className="text-[10px] text-gray-600 whitespace-pre-wrap break-all">{gasDebug}</pre>
                    <button onClick={() => setGasDebug(null)} className="text-[10px] text-gray-400 hover:text-gray-600 mt-1">dismiss</button>
                  </div>
                )}
              </div>}

              {/* Other reps "in touch" banners — restricted mode only */}
              {restricted && otherRepTouch.length > 0 && (
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  {otherRepTouch.map(t => (
                    <div key={t.name} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                        {t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-[11px] text-blue-800 leading-tight">
                        <span className="font-bold">{t.name}</span> is in touch with this customer
                        <span className="text-blue-500"> · last log {safeFormat(t.date, 'MMM d, yyyy')}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* History — restricted reps see only their own + CS notes */}
              <div className="border-t border-gray-100 pt-1">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-3">
                  {restricted ? 'Your Notes & Customer Service' : 'History'} {displayActivities.length > 0 && <span className="text-gray-400 font-normal normal-case">({displayActivities.length})</span>}
                </p>
                <div className="space-y-2">
                  {displayActivities.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6">{restricted ? 'You haven\'t logged anything here yet.' : 'No activity logged yet.'}</p>
                  )}
                  {displayActivities.map(activity => {
                    const isEmailEntry = activity.type === 'email' || looksLikeEmail(activity.summary);
                    const parsed = isEmailEntry ? parseEmailSummary(activity.summary) : null;

                    if (isEmailEntry) {
                      const isSent = parsed?.direction === 'sent' || (!parsed?.direction && activity.type === 'email');
                      return (
                        <div key={activity.id} className="rounded-xl border border-red-100 bg-white overflow-hidden">
                          <div className={`flex items-center gap-2 px-3 py-1.5 ${isSent ? 'bg-red-50' : 'bg-green-50'}`}>
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${isSent ? 'bg-red-100' : 'bg-green-100'}`}>
                              {isSent ? <ArrowUpRight size={10} className="text-red-500" /> : <ArrowDownLeft size={10} className="text-green-600" />}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${isSent ? 'text-red-500' : 'text-green-600'}`}>
                              {isSent ? 'Email Sent' : 'Email Received'}
                            </span>
                            {parsed?.address && <span className="text-[10px] text-gray-400 truncate flex-1">{parsed.address}</span>}
                            <span className="text-[10px] text-gray-400 flex-shrink-0 ml-auto">{safeFormat(activity.date, 'MMM d')}</span>
                          </div>
                          <div className="px-3 py-2">
                            {parsed?.subject
                              ? <><p className="text-[11px] font-bold text-gray-800">{parsed.subject}</p>
                                  {parsed.body && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{parsed.body}</p>}</>
                              : <p className="text-[11px] text-gray-600 line-clamp-2">{activity.summary.replace(/^\[[^\]]+\]\s*/, '')}</p>
                            }
                            <p className="text-[10px] text-gray-400 mt-1">{activity.repName}</p>
                          </div>
                        </div>
                      );
                    }

                    if (activity.type === 'call') return (
                      <div key={activity.id} className="rounded-xl border border-blue-100 bg-white overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50">
                          <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0"><PhoneCall size={10} className="text-blue-600" /></div>
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Phone Call</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{safeFormat(activity.date, 'MMM d')}</span>
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-[11px] text-gray-700 leading-relaxed">{activity.summary}</p>
                          {activity.followUpDate && <div className="flex items-center gap-1 mt-1"><Clock size={9} className="text-amber-500" /><span className="text-[10px] text-amber-600 font-semibold">Follow-up: {safeFormat(activity.followUpDate, 'MMM d')}</span></div>}
                          <p className="text-[10px] text-gray-400 mt-1">{activity.repName}</p>
                        </div>
                      </div>
                    );

                    if (activity.type === 'visit') return (
                      <div key={activity.id} className="rounded-xl border border-green-100 bg-white overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50">
                          <div className="w-5 h-5 rounded-md bg-green-100 flex items-center justify-center flex-shrink-0"><Navigation size={10} className="text-green-600" /></div>
                          <span className="text-[10px] font-black text-green-600 uppercase tracking-wider">Field Visit</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{safeFormat(activity.date, 'MMM d')}</span>
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-[11px] text-gray-700 leading-relaxed">{activity.summary}</p>
                          {activity.followUpDate && <div className="flex items-center gap-1 mt-1"><Clock size={9} className="text-amber-500" /><span className="text-[10px] text-amber-600 font-semibold">Follow-up: {safeFormat(activity.followUpDate, 'MMM d')}</span></div>}
                          <p className="text-[10px] text-gray-400 mt-1">{activity.repName}</p>
                        </div>
                      </div>
                    );

                    return (
                      <div key={activity.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50">
                          <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0"><FileText size={10} className="text-gray-500" /></div>
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Note</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{safeFormat(activity.date, 'MMM d')}</span>
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-[11px] text-gray-700 leading-relaxed">{activity.summary}</p>
                          {activity.followUpDate && <div className="flex items-center gap-1 mt-1"><Clock size={9} className="text-amber-500" /><span className="text-[10px] text-amber-600 font-semibold">Follow-up: {safeFormat(activity.followUpDate, 'MMM d')}</span></div>}
                          <p className="text-[10px] text-gray-400 mt-1">{activity.repName}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Schedule tab */}
          {tab === 'schedule' && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Frequency</label>
                  <div className="relative">
                    <select
                      value={schedFreq}
                      onChange={e => setSchedFreq(e.target.value as 'weekly' | 'biweekly' | 'monthly' | '')}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none appearance-none focus:border-amber-400"
                    >
                      {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Start Date</label>
                  <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-amber-400" />
                </div>
              </div>
              {previewVisit && (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  <span className="text-[11px] text-gray-600">Next visit: <span className="font-bold text-gray-800">{safeFormat(previewVisit.toISOString(), 'EEE, MMM d')}</span></span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${getDueDateColor(previewVisit)}`}>{getDueDateLabel(previewVisit)}</span>
                </div>
              )}
              {schedChanged && (
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule}
                  className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
                    savedSchedule ? 'bg-green-500 text-white' :
                    savingSchedule ? 'bg-gray-200 text-gray-400' :
                    'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {savedSchedule ? '✓ Saved' : savingSchedule ? 'Saving…' : 'Save Schedule'}
                </button>
              )}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-400">Territory: <span className="font-semibold text-gray-600">{customer.territory || '—'}</span></p>
                <p className="text-[10px] text-gray-400 mt-1">Address: <span className="font-semibold text-gray-600">{customer.billingAddress || '—'}</span></p>
              </div>
            </div>
          )}

          {/* Revenue tab */}
          {tab === 'revenue' && revenueTable.length > 0 && (
            <div className="p-4 space-y-3">
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Year</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Q1</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Q2</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Q3</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Q4</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-400 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueTable.map(([yr, d]) => (
                      <tr key={yr} className={`border-b border-gray-50 last:border-0 ${yr === currentYear ? 'bg-amber-50/50' : ''}`}>
                        <td className="px-3 py-2 font-black text-gray-900">{yr}</td>
                        {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                          <td key={q} className="px-3 py-2 text-right text-gray-600">
                            {d[q] > 0 ? `$${(d[q]/1000).toFixed(1)}k` : '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-black text-amber-600">
                          ${d.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {chartData.length > 1 && (
                <div className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] font-black text-gray-800 uppercase tracking-wider mb-2">Revenue by Year</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={34} />
                      <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, '']} labelStyle={{ fontWeight: 700 }} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {chartData.map(d => <Cell key={d.year} fill={d.year === currentYear ? '#F59E0B' : '#0F2A4A'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
