import { create } from 'zustand';
import type { Customer, Activity } from '../types';
import { CUSTOMERS, ACTIVITIES } from '../api/mockData';
import {
  fetchCustomers, fetchActivities, saveActivity as gasSave,
  deleteActivity as gasDelete, isGASConfigured, triggerEmailSync,
  type GASCustomer, type GASActivity,
} from '../api/sheets';
import { useAuthStore } from './authStore';

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
  activities: Activity[];
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
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  // Start with mock data so the UI is never blank while GAS loads
  customers: CUSTOMERS,
  activities: ACTIVITIES,
  lastSync: null,
  isSyncing: false,
  isSyncingEmails: false,
  syncError: null,

  loadFromGAS: async () => {
    if (!isGASConfigured()) return; // stay on mock data
    set({ isSyncing: true, syncError: null });
    const userEmail = useAuthStore.getState().currentUser?.email ?? '';
    try {
      const [rawCustomers, rawActivities] = await Promise.all([
        fetchCustomers(userEmail),
        fetchActivities(),
      ]);
      set({
        customers: rawCustomers.map(gasCustomerToLocal),
        activities: rawActivities.map(gasActivityToLocal),
        lastSync: new Date(),
        isSyncing: false,
      });
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
}));
