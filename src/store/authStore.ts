import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SalesRep } from '../types';
import { SALES_REPS } from '../api/mockData';
import { loginUser, isGASConfigured, type GASUser } from '../api/sheets';

interface AuthState {
  currentUser: SalesRep | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;
  // Demo mode: pick a rep by ID (no password needed)
  loginDemo: (repId: string) => void;
  // GAS mode: email + password against Users sheet
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

function gasUserToRep(u: GASUser): SalesRep {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    territory: u.territory,
    email: u.email,
    avatarInitials: u.avatarInitials || u.name.split(' ').map(n => n[0]).join('').toUpperCase(),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,
      isLoading: false,
      loginError: null,

      loginDemo: (repId: string) => {
        const rep = SALES_REPS.find(r => r.id === repId);
        if (rep) set({ currentUser: rep, isAuthenticated: true, loginError: null });
      },

      loginWithCredentials: async (email: string, password: string) => {
        set({ isLoading: true, loginError: null });
        try {
          const user = await loginUser(email, password);
          set({ currentUser: gasUserToRep(user), isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false, loginError: err instanceof Error ? err.message : 'Login failed' });
        }
      },

      logout: () => set({ currentUser: null, isAuthenticated: false, loginError: null }),
    }),
    {
      name: 'sunlite-auth',           // localStorage key
      partialize: (state) => ({        // only persist what's needed
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Expose whether we're in GAS mode so Login page can show the right UI
export { isGASConfigured };
