// ── Google Apps Script middleware layer ───────────────────────
// All reads → GET ?action=xxx
// All writes → POST with JSON body { action, ...fields }
// Set VITE_GAS_URL in .env to your deployed Apps Script URL

const GAS_URL = import.meta.env.VITE_GAS_URL as string | undefined;

export function isGASConfigured(): boolean {
  return Boolean(GAS_URL && GAS_URL.startsWith('https://'));
}

// ── Generic helpers ───────────────────────────────────────────

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<T[]> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL is not configured');
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(`[GAS:${action}] ${json.error}`);
  return json.data ?? [];
}

async function gasPost<T = { success: boolean }>(body: Record<string, unknown>): Promise<T> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL is not configured');
  const res = await fetch(GAS_URL, {
    method: 'POST',
    // GAS doPost requires text/plain (not application/json) to avoid CORS preflight
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(`[GAS:${String(body.action)}] ${json.error}`);
  return json as T;
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

export async function loginUser(email: string, password: string): Promise<GASUser> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL is not configured');
  const url = new URL(GAS_URL);
  url.searchParams.set('action', 'login');
  url.searchParams.set('email', email.toLowerCase().trim());
  url.searchParams.set('password', password);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Invalid email or password');
  return json.user as GASUser;
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
  dayOfWeek: number;
}

export async function fetchCustomers(): Promise<GASCustomer[]> {
  const raw = await gasGet<Record<string, unknown>>('getCustomers');
  return raw.map(r => ({
    ...r,
    priorityTier: Number(r.priorityTier) || 1,
    openOrderCount: Number(r.openOrderCount) || 0,
    revenue: Number(r.revenue) || 0,
    dayOfWeek: Number(r.dayOfWeek) || 1,
    activeStatus: r.activeStatus === 'true' || r.activeStatus === true,
  })) as GASCustomer[];
}

export async function updateCustomerField(id: string, fields: Record<string, unknown>): Promise<void> {
  await gasPost({ action: 'updateCustomer', id, ...fields });
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
}

export async function fetchActivities(): Promise<GASActivity[]> {
  return gasGet<GASActivity>('getLogs');
}

export async function saveActivity(activity: GASActivity): Promise<{ id: string }> {
  return gasPost<{ id: string }>({ action: 'saveLog', ...activity });
}

export async function deleteActivity(id: string): Promise<void> {
  await gasPost({ action: 'deleteLog', id });
}

// ── Users ─────────────────────────────────────────────────────

export async function fetchUsers(): Promise<GASUser[]> {
  return gasGet<GASUser>('getUsers');
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

export async function fetchQuickLinks(): Promise<GASQuickLink[]> {
  return gasGet<GASQuickLink>('getQuickLinks');
}

// ── Health check ──────────────────────────────────────────────

export async function pingGAS(): Promise<boolean> {
  try {
    if (!GAS_URL) return false;
    const url = new URL(GAS_URL);
    url.searchParams.set('action', 'ping');
    const res = await fetch(url.toString());
    const json = await res.json();
    return json.status === 'ok';
  } catch {
    return false;
  }
}
