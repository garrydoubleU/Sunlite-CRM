import { create } from 'zustand';

interface GmailState {
  accessToken: string | null;
  tokenExpiry: number | null;
  signature: string | null;
  isAuthorizing: boolean;
  authError: string | null;
  setToken: (token: string, expiresIn: number) => void;
  setSignature: (sig: string) => void;
  clearToken: () => void;
  setAuthorizing: (v: boolean) => void;
  setError: (msg: string | null) => void;
  isTokenValid: () => boolean;
}

const GMAIL_AUTH_KEY = 'sunlite-gmail-authorized';

// Token lives in memory; authorization state persists in localStorage so we
// can silently re-acquire the token on next page load without a popup.
export const useGmailStore = create<GmailState>((set, get) => ({
  accessToken: null,
  tokenExpiry: null,
  signature: null,
  isAuthorizing: false,
  authError: null,

  setToken: (token, expiresIn) => {
    localStorage.setItem(GMAIL_AUTH_KEY, '1');
    set({
      accessToken: token,
      tokenExpiry: Date.now() + expiresIn * 1000 - 60_000, // 1-min buffer
      authError: null,
      isAuthorizing: false,
    });
  },

  setSignature: (sig) => set({ signature: sig }),

  clearToken: () => {
    localStorage.removeItem(GMAIL_AUTH_KEY);
    set({ accessToken: null, tokenExpiry: null, signature: null, authError: null });
  },

  setAuthorizing: (v) => set({ isAuthorizing: v }),
  setError: (msg) => set({ authError: msg, isAuthorizing: false }),

  isTokenValid: () => {
    const { accessToken, tokenExpiry } = get();
    return Boolean(accessToken && tokenExpiry && Date.now() < tokenExpiry);
  },
}));

export function hasPreviousGmailAuth(): boolean {
  return localStorage.getItem(GMAIL_AUTH_KEY) === '1';
}
