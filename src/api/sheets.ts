// ── Google Apps Script middleware layer ───────────────────────
// Matches the existing Sunshine Lighting CRM Apps Script format exactly.
// Their login uses ?userEmail=&password=  and returns { status, userRole, userName }
// Their getCustomers returns flat objects with normalized keys (Customer, ID, SalesRep, etc.)
// Their getLogs returns objects with whitespace-stripped header keys

const GAS_URL = import.meta.env.VITE_GAS_URL as string | undefined;

export function isGASConfigured(): boolean {
  return Boolean(GAS_URL && GAS_URL.startsWith('https://'));
}

// ── Generic helpers ───────────────────────────────────────────

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL is not configured');
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json() as Promise<T>;
}

// GAS doPost reads e.postData.contents — send as text/plain to skip preflight
async function gasPost<T = { status: string }>(params: Record<string, string>): Promise<T> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL is not configured');
  // Build as URL params appended to the GAS URL (their doPost falls back to doGet params)
  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────

export interface GASUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'field_sales' | 'inside_sales' | 'customer_service';
  territory: string;
  avatarInitials: string;
}

// Maps their role strings to our Role type
function normalizeRole(role: string): GASUser['role'] {
  const r = role?.toLowerCase().trim() ?? '';
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r.includes('field')) return 'field_sales';
  if (r.includes('inside')) return 'inside_sales';
  if (r.includes('service') || r.includes('cs') || r.includes('support')) return 'customer_service';
  return 'field_sales'; // default
}

// Their login returns: { status: "Success", userRole, userName }
export async function loginUser(email: string, password: string): Promise<GASUser> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL is not configured');
  const url = new URL(GAS_URL);
  url.searchParams.set('action', 'login');
  url.searchParams.set('userEmail', email.toLowerCase().trim()); // their param name
  url.searchParams.set('password', password);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error || json.status !== 'Success') {
    throw new Error(json.error ?? 'Invalid credentials');
  }
  const initials = (json.userName as string)
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  return {
    id: email.toLowerCase().trim(),
    name: json.userName as string,
    email: email.toLowerCase().trim(),
    role: normalizeRole(json.userRole as string),
    territory: '',  // not returned by their login — enriched later from getUsers
    avatarInitials: initials,
  };
}

// ── Customers ─────────────────────────────────────────────────

export interface GASCustomer {
  id: string;
  name: string;
  assignedRepId: string;
  assignedRepName: string;
  territory: string;
  billingAddress: string;
  phone: string;
  email: string;
  priorityTier: number;
  customerClass: string;
  visitFrequency: 'weekly' | 'biweekly' | 'monthly';
  lastContactDate: string;
  activeStatus: boolean;
  openOrderCount: number;
  revenue: number;
  revenueByQuarter: Record<string, number>;
  dayOfWeek: number;
}

// Safe date parser — never throws, returns fallback ISO string
function safeDate(val: unknown, fallback = new Date().toISOString()): string {
  if (!val || val === '' || val === 'null' || val === 'undefined') return fallback;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? fallback : d.toISOString();
}

// Their getCustomers returns objects with these normalized keys:
//   ID, Customer (or CustomerName), SalesRep (email), SalespersonName,
//   LastOrderDate, VisitFrequency, VisitStartDate, Priority, revenue cols Q1_2023 etc.
function mapRawCustomer(r: Record<string, unknown>): GASCustomer {
  const priorityRaw = String(r.Priority ?? r.priority ?? '').toLowerCase();
  const tierMap: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, high: 1, medium: 2, low: 3 };
  const tier = tierMap[priorityRaw] ?? 2;

  const freqRaw = String(r.VisitFrequency ?? r.visitFrequency ?? r.Frequency ?? '').toLowerCase();
  const freqMap: Record<string, GASCustomer['visitFrequency']> = {
    weekly: 'weekly', 'bi-weekly': 'biweekly', biweekly: 'biweekly', monthly: 'monthly',
  };
  const freq = freqMap[freqRaw] ?? 'monthly';

  // Collect quarterly revenue columns — handles Q1_2023, Q1 2023, 2023Q1, Q1-2023
  let revenue = 0;
  const revenueByQuarter: Record<string, number> = {};
  Object.entries(r).forEach(([k, v]) => {
    const num = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : NaN);
    if (isNaN(num) || num === 0) return;
    // Match Q1_2023 / Q1 2023 / Q1-2023
    let m = k.match(/^Q(\d)[_ -](\d{4})$/i);
    // Match 2023_Q1 / 2023 Q1
    if (!m) m = k.match(/^(\d{4})[_ -]Q(\d)$/i) && k.match(/^(\d{4})[_ -]Q(\d)$/i);
    if (m) {
      // Normalise to Q1_2023 format
      const q = m[1].length === 1 ? m[1] : m[2];
      const yr = m[1].length === 4 ? m[1] : m[2];
      const key = `Q${q}_${yr}`;
      revenue += num;
      revenueByQuarter[key] = (revenueByQuarter[key] ?? 0) + num;
    }
  });

  // Derive dayOfWeek from VisitStartDate if present
  let dayOfWeek = 1;
  const startDate = r.VisitStartDate ?? r.visitStartDate;
  if (startDate) {
    const d = new Date(String(startDate));
    if (!isNaN(d.getTime())) dayOfWeek = d.getDay();
  }

  return {
    id: String(r.ID ?? r.id ?? r.CustomerID ?? ''),
    name: String(r.Customer ?? r.CustomerName ?? r.customer ?? ''),
    // "Sales Rep Email" → GAS strips spaces → SalesRepEmail; may be comma-separated list of reps
    assignedRepId: String(r.SalesRepEmail ?? r.SalesRep ?? r.salesRep ?? r.RepEmail ?? '').toLowerCase().trim(),
    assignedRepName: String(r.SalespersonName ?? r.RepName ?? r.SalesRepEmail ?? r.SalesRep ?? ''),
    territory: String(r.Territory ?? r.territory ?? ''),
    billingAddress: String(r.Address ?? r.BillingAddress ?? r.address ?? ''),
    phone: String(r.Phone ?? r.phone ?? ''),
    email: String(r.Email ?? r.CustomerEmail ?? r.email ?? ''),
    priorityTier: tier as 1 | 2 | 3 | 4,
    customerClass: String(r.Category ?? r.CustomerClass ?? r.Type ?? ''),
    visitFrequency: freq,
    lastContactDate: safeDate(r.LastOrderDate ?? r.LastContact ?? r.VisitStartDate),
    activeStatus: String(r.Status ?? r.status ?? 'active').toLowerCase() !== 'inactive',
    openOrderCount: Number(r.OpenOrders ?? r.openOrders ?? 0),
    revenue,
    revenueByQuarter,
    dayOfWeek,
  };
}

export async function fetchCustomers(userEmail?: string): Promise<GASCustomer[]> {
  const raw = await gasGet<Record<string, unknown>[]>(
    'getCustomers',
    userEmail ? { userEmail } : {}
  );
  return (Array.isArray(raw) ? raw : []).map(mapRawCustomer);
}

// ── Activities / Logs ─────────────────────────────────────────

export interface GASActivity {
  id: string;
  customerId: string;
  type: 'note' | 'call' | 'visit' | 'email';
  date: string;
  repName: string;
  summary: string;
  source?: 'manual' | 'gmail-auto';
  followUpDate?: string;
}

// Their log rows come back with whitespace-stripped header keys:
// Timestamp, UserEmail (or userEmail), CustomerName, Notes, Reason,
// NewEmail, FollowUpDate, LogType, Priority
function mapRawLog(r: Record<string, unknown>, idx: number): GASActivity {
  const logType = String(r.LogType ?? r.logType ?? r.Type ?? 'note').toLowerCase();
  const typeMap: Record<string, GASActivity['type']> = {
    'phone call': 'call', call: 'call', phone: 'call',
    visit: 'visit', 'in-person': 'visit', field: 'visit',
    email: 'email', note: 'note', other: 'note',
  };

  const customerName = String(r.CustomerName ?? r.Customer ?? r.customername ?? '');
  const customerID = String(r.CustomerID ?? r.ID ?? r.customerId ?? '');

  const followUpRaw = r.FollowUpDate ?? r.followUpDate ?? r.FollowUp ?? '';
  const followUpDate = followUpRaw ? safeDate(followUpRaw, '') : undefined;

  return {
    id: String(r.ID ?? r.id ?? `log_${idx}`),
    customerId: customerID || customerName,
    type: typeMap[logType] ?? 'note',
    date: safeDate(r.Timestamp),
    repName: String(r.UserEmail ?? r.userEmail ?? r.RepName ?? ''),
    summary: String(r.Notes ?? r.notes ?? r.Summary ?? ''),
    source: 'manual',
    ...(followUpDate ? { followUpDate } : {}),
  };
}

export async function fetchActivities(): Promise<GASActivity[]> {
  const raw = await gasGet<Record<string, unknown>[]>('getLogs');
  return (Array.isArray(raw) ? raw : []).map(mapRawLog);
}

// Save a log using their existing saveLog parameter names
export async function saveActivity(
  activity: GASActivity,
  customerName: string,
  userEmail: string
): Promise<void> {
  const logTypeMap: Record<string, string> = {
    call: 'Phone Call', visit: 'Visit', email: 'Email', note: 'Note',
  };
  await gasPost({
    action: 'saveLog',
    userEmail,
    CustomerName: customerName,
    CustomerID: activity.customerId,
    Notes: activity.summary,
    LogType: logTypeMap[activity.type] ?? 'Note',
    Reason: '',
    NewEmail: '',
    FollowUpDate: activity.followUpDate ?? '',
    Priority: '',
  });
}

export async function deleteActivity(id: string): Promise<void> {
  await gasPost({ action: 'deleteLog', id });
}

// ── Email ─────────────────────────────────────────────────────

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  customerName: string;
  customerId: string;
  userEmail: string;
  repName: string;
}): Promise<void> {
  await gasPost({
    action: 'sendEmail',
    to: params.to,
    subject: params.subject,
    body: params.body,
    customerName: params.customerName,
    customerId: params.customerId,
    userEmail: params.userEmail,
    repName: params.repName,
  });
}

// ── Users ─────────────────────────────────────────────────────

export async function fetchUsers(): Promise<GASUser[]> {
  const raw = await gasGet<Record<string, unknown>[]>('getUsers');
  return (Array.isArray(raw) ? raw : []).map(u => ({
    id: String(u.email ?? u.Email ?? '').toLowerCase().trim(),
    name: String(u.name ?? u.Name ?? u.username ?? ''),
    email: String(u.email ?? u.Email ?? '').toLowerCase().trim(),
    role: normalizeRole(String(u.role ?? u.Role ?? '')),
    territory: String(u.territory ?? u.Territory ?? ''),
    avatarInitials: String(u.name ?? u.Name ?? '').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
  }));
}

// ── Quick Links ───────────────────────────────────────────────

export interface GASQuickLink {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  url: string;
}

// Their quicklinks sheet can have any column names — we try common ones
export async function fetchQuickLinks(): Promise<GASQuickLink[]> {
  const raw = await gasGet<Record<string, unknown>[]>('getQuickLinks');
  return (Array.isArray(raw) ? raw : []).map((r, i) => ({
    id: String(r.id ?? r.ID ?? i),
    label: String(r.Label ?? r.label ?? r.Name ?? r.name ?? r.Title ?? r.A ?? ''),
    icon: String(r.Icon ?? r.icon ?? 'Link'),
    description: String(r.Description ?? r.description ?? r.Notes ?? r.B ?? ''),
    color: String(r.Color ?? r.color ?? 'bg-amber-50 text-amber-600'),
    url: String(r.URL ?? r.url ?? r.Link ?? r.link ?? r.C ?? '#'),
  }));
}

// ── Email sync ────────────────────────────────────────────────

export async function triggerEmailSync(): Promise<void> {
  await gasGet<{ status: string }>('syncEmails');
}

// ── Connection check ──────────────────────────────────────────

export async function pingGAS(): Promise<boolean> {
  try {
    if (!GAS_URL) return false;
    const url = new URL(GAS_URL);
    url.searchParams.set('action', 'ping');
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    await res.json(); // consume body
    // Their script returns { error: "Action 'ping' not handled." } — that's still a live connection
    return res.ok;
  } catch {
    return false;
  }
}
