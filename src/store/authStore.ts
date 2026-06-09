import { create } from 'zustand';
import type { SalesRep } from '../types';
import { SALES_REPS } from '../api/mockData';

interface AuthState {
  currentUser: SalesRep | null;
  isAuthenticated: boolean;
  login: (repId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  isAuthenticated: false,
  login: (repId: string) => {
    const rep = SALES_REPS.find(r => r.id === repId);
    if (rep) set({ currentUser: rep, isAuthenticated: true });
  },
  logout: () => set({ currentUser: null, isAuthenticated: false }),
}));
