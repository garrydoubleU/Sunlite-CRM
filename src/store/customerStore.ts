import { create } from 'zustand';
import type { Customer, Activity } from '../types';
import { CUSTOMERS, ACTIVITIES } from '../api/mockData';

interface CustomerState {
  customers: Customer[];
  activities: Activity[];
  lastSync: Date | null;
  isSyncing: boolean;
  addActivity: (activity: Activity) => void;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
  deleteActivity: (id: string) => void;
  getActivitiesForCustomer: (customerId: string) => Activity[];
  triggerSync: () => void;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: CUSTOMERS,
  activities: ACTIVITIES,
  lastSync: null,
  isSyncing: false,

  addActivity: (activity) => set(state => ({
    activities: [activity, ...state.activities],
  })),

  updateActivity: (id, updates) => set(state => ({
    activities: state.activities.map(a => a.id === id ? { ...a, ...updates } : a),
  })),

  deleteActivity: (id) => set(state => ({
    activities: state.activities.filter(a => a.id !== id),
  })),

  getActivitiesForCustomer: (customerId) => {
    return get().activities
      .filter(a => a.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  triggerSync: () => {
    set({ isSyncing: true });
    setTimeout(() => set({ isSyncing: false, lastSync: new Date() }), 1200);
  },
}));
