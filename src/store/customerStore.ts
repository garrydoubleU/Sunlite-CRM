import { create } from 'zustand';
import type { Customer, Activity, Assignment, AccessRequest, CSHandoff, Role } from '../types';
import { CUSTOMERS, ACTIVITIES } from '../api/mockData';
import {
  fetchCustomers, fetchAllCustomers, fetchActivities, saveActivity as gasSave,
  deleteActivity as gasDelete, isGASConfigured, triggerEmailSync, fetchUsers,
  assignCustomer as gasAssign, fetchAssignments, acknowledgeAssignment as gasAck,
  requestAccess as gasRequestAccess, fetchAccessRequests, resolveAccessRequest as gasResolve,
  fetchCSHandoffs, acknowledgeCSHandoff, fetchCSHandoffsByCSEmail, nudgeRep as gasNudgeRep,
  type GASCustomer, type GASActivity,
} from '../api/sheets';
import { useAuthStore } from './authStore';

// An account belongs to a rep if their email appears in the (possibly
// comma/semicolon-separated) Sales Rep Email field. Owner/admin see everything.
export function ownsAccount(customer: Customer, email: string): boolean {
  if (!email) return false;
  const reps = String(customer.assignedRepId ?? '')
    .toLowerCase()
    .split(/[,;\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return reps.includes(email.toLowerCase().trim()) || reps.includes('open');
}

function gasCustomerToLocal(c: GASCustomer): Customer {
  return {
    id: c.id,
    name: c.name,
    assignedRepId: c.assignedRepId,
    assignedRepName: c.assignedRepName,
    territory: c.territory,
    billingAddress: c.billingAddress,
    city: c.city,
    state: c.state,
    phone: c.phone,
    email: c.email,
    priorityTier: c.priorityTier as 1 | 2 | 3 | 4,
    customerClass: c.customerClass,
    visitFrequency: c.visitFrequency,
    lastContactDate: c.lastContactDate,
    activeStatus: c.activeStatus,
    openOrderCount: c.openOrderCount,
    revenue: c.revenue,
    revenueByQuarter: c.revenueByQuarter,
    dayOfWeek: c.dayOfWeek,
  };
}

function gasActivityToLocal(a: GASActivity): Activity {
  return {
    id: a.id,
    customerId: a.customerId,
    type: a.type,
    date: a.date,
    repName: a.repName,
    summary: a.summary,
    source: a.source ?? 'manual',
    ...(a.loggerEmail ? { loggerEmail: a.loggerEmail } : {}),
    ...(a.followUpDate ? { followUpDate: a.followUpDate } : {}),
    ...(a.notifyRep ? { notifyRep: a.notifyRep } : {}),
  };
}

interface CustomerState {
  customers: Customer[];
  directory: Customer[];
  activities: Activity[];
  assignments: Assignment[];
  accessRequests: AccessRequest[];
  csHandoffs: CSHandoff[];
  // email → display name map built from the Users sheet
  emailToName: Record<string, string>;
  lastSync: Date | null;
  isSyncing: boolean;
  syncError: string | null;
  // Reads
  loadFromGAS: () => Promise<void>;
  triggerSync: () => void;
  syncEmails: () => Promise<void>;
  isSyncingEmails: boolean;
  // Customer field updates
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  // Activity CRUD — optimistic UI + background GAS write
  addActivity: (activity: Activity) => Promise<Record<string, unknown>>;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
  deleteActivity: (id: string) => void;
  getActivitiesForCustomer: (customerId: string) => Activity[];
  // Assignment & access-request flows
  assignAccount: (customer: Customer, toEmail: string, toName: string) => Promise<void>;
  acknowledgeAssignment: (id: string) => void;
  requestAccess: (customer: Customer) => Promise<void>;
  loadAccessRequests: () => Promise<void>;
  resolveAccessRequest: (id: string, grant: boolean) => Promise<void>;
  // CS Handoff flows
  loadCSHandoffs: () => Promise<void>;
  ackCSHandoff: (id: string, ackNote?: string) => void;
  // CS Tasks view (sent by this CS user)
  csTasksSent: CSHandoff[];
  loadCSTasksSent: () => Promise<void>;
  nudgeRep: (id: string) => Promise<void>;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  // Start with mock data so the UI is never blank while GAS loads
  customers: CUSTOMERS,
  directory: CUSTOMERS,
  activities: ACTIVITIES,
  assignments: [],
  accessRequests: [],
  csHandoffs: [],
  csTasksSent: [],
  emailToName: {},
  lastSync: null,
  isSyncing: false,
  isSyncingEmails: false,
  syncError: null,

  loadFromGAS: async () => {
    if (!isGASConfigured()) return; // stay on mock data
    set({ isSyncing: true, syncError: null });
    const currentUser = useAuthStore.getState().currentUser;
    const email = currentUser?.email ?? '';
    // Owners and admins see every account — pass no email so GAS returns all.
    // Reps get only their assigned book, filtered server-side by email.
    const seesAll = currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.role === 'customer_service';
    try {
      const [rawCustomers, rawActivities, rawUsers] = await Promise.all([
        seesAll ? fetchAllCustomers(email) : fetchCustomers(email),
        fetchActivities(),
        fetchUsers().catch(() => []),
      ]);

      // Build email → display name map so log entries show "Garry" not the email
      const emailToName: Record<string, string> = {};
      // Build a comprehensive name/email → role map so we can tell who logged what
      const nameToRole: Record<string, string> = {};
      rawUsers.forEach(u => {
        if (u.email && u.name) emailToName[u.email.toLowerCase().trim()] = u.name;
        if (u.name) {
          const full = u.name.toLowerCase().trim();
          nameToRole[full] = u.role;
          const first = full.split(/\s+/)[0];
          if (first && !(first in nameToRole)) nameToRole[first] = u.role;
        }
        if (u.email) {
          nameToRole[u.email.toLowerCase().trim()] = u.role;
          nameToRole[u.email.toLowerCase().split('@')[0]] = u.role;
        }
      });
      const roleOfLogger = (repName: string): Role | undefined => {
        const key = (repName || '').toLowerCase().trim();
        return (nameToRole[key] as Role) ?? (nameToRole[key.split(/\s+/)[0]] as Role) ?? undefined;
      };

      const enrichRepName = (raw: string): string => {
        if (!raw || !raw.trim()) return 'Unknown';
        const trimmed = raw.trim();
        const lower = trimmed.toLowerCase();
        if (lower.includes('@')) {
          // Try exact lowercase match first, then any partial match
          if (emailToName[lower]) return emailToName[lower];
          const matchKey = Object.keys(emailToName).find(k => k === lower || lower.endsWith('@' + k.split('@')[1]));
          if (matchKey) return emailToName[matchKey];
          // Fallback: use part before @ and capitalize it
          const prefix = lower.split('@')[0];
          return prefix.charAt(0).toUpperCase() + prefix.slice(1);
        }
        return trimmed;
      };

      const customers = rawCustomers.map(gasCustomerToLocal);
      set(state => ({
        customers,
        // Owners/admins already see everyone, so customers === directory.
        // Reps: keep whatever full directory we already have (don't clobber
        // it back down to their own book while the background fetch below
        // re-populates it — that's what made search flaky).
        directory: seesAll ? customers : (state.directory.length > 0 ? state.directory : customers),
        emailToName,
        activities: rawActivities.map((a): Activity => {
          const repName = enrichRepName(a.repName);
          // A customer-service shared inbox (e.g. customer-service@…) is always
          // treated as CS — its notes are public — even if the Users sheet role
          // is mislabeled. Otherwise match by reliable email, then by name.
          const csByEmail = /customer-?service|custserv|(^|[._-])cs@/i.test(a.loggerEmail ?? '');
          const loggedByRole: Role | undefined = csByEmail
            ? 'customer_service'
            : (a.loggerEmail ? (nameToRole[a.loggerEmail] as Role | undefined) : undefined)
              ?? roleOfLogger(a.repName)
              ?? roleOfLogger(repName);
          return { ...gasActivityToLocal(a), repName, loggedByRole };
        }),
        lastSync: new Date(),
        isSyncing: false,
      }));

      // Reps: load the full directory in the background so search reaches
      // accounts outside their book, plus any assignments addressed to them.
      if (!seesAll && email) {
        fetchAllCustomers()
          .then(all => { if (all.length > 0) set({ directory: all.map(gasCustomerToLocal) }); })
          .catch(() => {});
        fetchAssignments(email)
          .then(assignments => set({ assignments }))
          .catch(() => {});
        fetchCSHandoffs(email)
          .then(csHandoffs => set({ csHandoffs }))
          .catch(() => {});
      }
      // Admin: load pending access requests
      if (currentUser?.role === 'admin' || currentUser?.role === 'field_sales' || currentUser?.role === 'inside_sales') {
        get().loadAccessRequests();
      }
    } catch (err) {
      set({
        isSyncing: false,
        syncError: err instanceof Error ? err.message : 'Sync failed',
      });
    }
  },

  updateCustomer: (id, updates) => {
    set(state => ({
      customers: state.customers.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  },

  triggerSync: () => {
    get().loadFromGAS();
  },

  syncEmails: async () => {
    if (!isGASConfigured()) return;
    set({ isSyncingEmails: true });
    try {
      await triggerEmailSync();
      const rawActivities = await fetchActivities();
      const lookup = get().emailToName;
      const enrich = (raw: string) => {
        if (!raw) return raw;
        const lower = raw.toLowerCase().trim();
        if (lower.includes('@')) return lookup[lower] ?? lower.split('@')[0];
        return raw;
      };
      set({
        activities: rawActivities.map(a => ({ ...gasActivityToLocal(a), repName: enrich(a.repName) })),
        isSyncingEmails: false,
      });
    } catch {
      set({ isSyncingEmails: false });
    }
  },

  addActivity: (activity: Activity): Promise<Record<string, unknown>> => {
    // Optimistic update — show immediately + update lastContactDate so dashboard re-sorts instantly
    const today = new Date().toISOString().split('T')[0];
    set(state => ({
      activities: [activity, ...state.activities],
      customers: state.customers.map(c =>
        c.id === activity.customerId || c.name.toLowerCase() === activity.customerId.toLowerCase()
          ? { ...c, lastContactDate: today }
          : c
      ),
    }));
    // Background write to GAS using their saveLog format
    if (isGASConfigured()) {
      const { currentUser } = useAuthStore.getState();
      const customer = get().customers.find(c => c.id === activity.customerId);
      return gasSave(
        activity as GASActivity,
        customer?.name ?? activity.customerId,
        currentUser?.email ?? ''
      ).catch(err => {
        console.error('[GAS] saveActivity failed:', err);
        set(state => ({ activities: state.activities.filter(a => a.id !== activity.id) }));
        return { error: String(err) };
      });
    }
    return Promise.resolve({ status: 'local-only' });
  },

  updateActivity: (id, updates) => {
    set(state => ({
      activities: state.activities.map(a => a.id === id ? { ...a, ...updates } : a),
    }));
  },

  deleteActivity: (id: string) => {
    const prev = get().activities.find(a => a.id === id);
    // Optimistic remove
    set(state => ({ activities: state.activities.filter(a => a.id !== id) }));
    // Background delete from GAS
    if (isGASConfigured() && prev) {
      gasDelete(id).catch(err => {
        console.error('[GAS] deleteActivity failed:', err);
        // Roll back
        if (prev) set(state => ({ activities: [prev, ...state.activities] }));
      });
    }
  },

  getActivitiesForCustomer: (customerId: string) => {
    // GAS activity logs store customer name as the ID (no numeric ID in the log sheet).
    // Match on both the numeric ID and the customer name so both paths work.
    const customer = get().customers.find(c => c.id === customerId)
      ?? get().directory.find(c => c.id === customerId);
    const customerName = customer?.name?.toLowerCase() ?? '';
    return get().activities
      .filter(a =>
        a.customerId === customerId ||
        (customerName && a.customerId.toLowerCase() === customerName)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  assignAccount: async (customer, toEmail, toName) => {
    const { currentUser } = useAuthStore.getState();
    // Optimistic local update so the UI reflects the new owner immediately
    set(state => ({
      customers: state.customers.map(c =>
        c.id === customer.id ? { ...c, assignedRepId: toEmail.toLowerCase(), assignedRepName: toName } : c
      ),
      directory: state.directory.map(c =>
        c.id === customer.id ? { ...c, assignedRepId: toEmail.toLowerCase(), assignedRepName: toName } : c
      ),
    }));
    if (isGASConfigured()) {
      await gasAssign({
        customerId: customer.id,
        customerName: customer.name,
        toEmail,
        toName,
        byEmail: currentUser?.email ?? '',
        byName: currentUser?.name ?? '',
      }).catch(err => console.error('[GAS] assignCustomer failed:', err));
    }
  },

  acknowledgeAssignment: (id: string) => {
    set(state => ({ assignments: state.assignments.filter(a => a.id !== id) }));
    if (isGASConfigured()) gasAck(id).catch(() => {});
  },

  requestAccess: async (customer) => {
    const { currentUser } = useAuthStore.getState();
    if (isGASConfigured()) {
      await gasRequestAccess({
        customerId: customer.id,
        customerName: customer.name,
        requesterEmail: currentUser?.email ?? '',
        requesterName: currentUser?.name ?? '',
      }).catch(err => console.error('[GAS] requestAccess failed:', err));
    }
  },

  loadAccessRequests: async () => {
    if (!isGASConfigured()) return;
    const requests = await fetchAccessRequests().catch(() => []);
    set({ accessRequests: requests });
  },

  resolveAccessRequest: async (id, grant) => {
    set(state => ({ accessRequests: state.accessRequests.filter(r => r.id !== id) }));
    if (isGASConfigured()) {
      await gasResolve(id, grant).catch(err => console.error('[GAS] resolveAccessRequest failed:', err));
    }
  },

  loadCSHandoffs: async () => {
    const { currentUser } = useAuthStore.getState();
    const email = currentUser?.email ?? '';
    if (!isGASConfigured() || !email) return;
    const handoffs = await fetchCSHandoffs(email).catch(() => []);
    set({ csHandoffs: handoffs });
  },

  ackCSHandoff: (id: string, ackNote?: string) => {
    set(state => ({ csHandoffs: state.csHandoffs.filter(h => h.id !== id) }));
    if (isGASConfigured()) acknowledgeCSHandoff(id, ackNote).catch(() => {});
  },

  loadCSTasksSent: async () => {
    const { currentUser } = useAuthStore.getState();
    const email = currentUser?.email ?? '';
    if (!isGASConfigured() || !email) return;
    const tasks = await fetchCSHandoffsByCSEmail(email).catch(() => []);
    set({ csTasksSent: tasks });
  },

  nudgeRep: async (id: string) => {
    if (isGASConfigured()) await gasNudgeRep(id).catch(() => {});
  },
}));
