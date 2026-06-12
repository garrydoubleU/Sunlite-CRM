import { create } from 'zustand';
import type { Customer, Activity, Assignment, AccessRequest } from '../types';
import { CUSTOMERS, ACTIVITIES } from '../api/mockData';
import {
  fetchCustomers, fetchAllCustomers, fetchActivities, saveActivity as gasSave,
  deleteActivity as gasDelete, isGASConfigured, triggerEmailSync,
  assignCustomer as gasAssign, fetchAssignments, acknowledgeAssignment as gasAck,
  requestAccess as gasRequestAccess, fetchAccessRequests, resolveAccessRequest as gasResolve,
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
  };
}

interface CustomerState {
  customers: Customer[];
  // Full company-wide account list — used so reps can SEARCH accounts
  // outside their own book (read-only). For owner/admin this equals customers.
  directory: Customer[];
  activities: Activity[];
  // Accounts assigned to the current rep (drives the "new account" alert)
  assignments: Assignment[];
  // Pending access requests (admin view)
  accessRequests: AccessRequest[];
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
  addActivity: (activity: Activity) => void;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
  deleteActivity: (id: string) => void;
  getActivitiesForCustomer: (customerId: string) => Activity[];
  // Assignment & access-request flows
  assignAccount: (customer: Customer, toEmail: string, toName: string) => Promise<void>;
  acknowledgeAssignment: (id: string) => void;
  requestAccess: (customer: Customer) => Promise<void>;
  loadAccessRequests: () => Promise<void>;
  resolveAccessRequest: (id: string, grant: boolean) => Promise<void>;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  // Start with mock data so the UI is never blank while GAS loads
  customers: CUSTOMERS,
  directory: CUSTOMERS,
  activities: ACTIVITIES,
  assignments: [],
  accessRequests: [],
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
    const seesAll = currentUser?.role === 'owner' || currentUser?.role === 'admin';
    try {
      const [rawCustomers, rawActivities] = await Promise.all([
        seesAll ? fetchAllCustomers() : fetchCustomers(email),
        fetchActivities(),
      ]);
      const customers = rawCustomers.map(gasCustomerToLocal);
      set({
        customers,
        directory: customers, // reps refine this below
        activities: rawActivities.map(gasActivityToLocal),
        lastSync: new Date(),
        isSyncing: false,
      });

      // Reps: load the full directory in the background so search reaches
      // accounts outside their book, plus any assignments addressed to them.
      if (!seesAll && email) {
        fetchAllCustomers()
          .then(all => set({ directory: all.map(gasCustomerToLocal) }))
          .catch(() => {});
        fetchAssignments(email)
          .then(assignments => set({ assignments }))
          .catch(() => {});
      }
      // Admin: load pending access requests
      if (currentUser?.role === 'admin') {
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
      // Reload activities to pick up newly logged emails
      const rawActivities = await fetchActivities();
      set({
        activities: rawActivities.map(gasActivityToLocal),
        isSyncingEmails: false,
      });
    } catch {
      set({ isSyncingEmails: false });
    }
  },

  addActivity: (activity: Activity) => {
    // Optimistic update — show immediately
    set(state => ({ activities: [activity, ...state.activities] }));
    // Background write to GAS using their saveLog format
    if (isGASConfigured()) {
      const { currentUser } = useAuthStore.getState();
      const customer = get().customers.find(c => c.id === activity.customerId);
      gasSave(
        activity as GASActivity,
        customer?.name ?? activity.customerId,
        currentUser?.email ?? ''
      ).catch(err => {
        console.error('[GAS] saveActivity failed:', err);
        set(state => ({ activities: state.activities.filter(a => a.id !== activity.id) }));
      });
    }
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
    const customer = get().customers.find(c => c.id === customerId);
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
}));
