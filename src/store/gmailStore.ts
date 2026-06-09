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

// Token is stored in memory only — never persisted to localStorage
export const useGmailStore = create<GmailState>((set, get) => ({
  accessToken: null,
  tokenExpiry: null,
  signature: null,
  isAuthorizing: false,
  authError: null,

  setToken: (token, expiresIn) =>
    set({
      accessToken: token,
      tokenExpiry: Date.now() + expiresIn * 1000 - 60_000, // 1-min buffer
      authError: null,
      isAuthorizing: false,
    }),

  setSignature: (sig) => set({ signature: sig }),

  clearToken: () =>
    set({ accessToken: null, tokenExpiry: null, signature: null, authError: null }),

  setAuthorizing: (v) => set({ isAuthorizing: v }),
  setError: (msg) => set({ authError: msg, isAuthorizing: false }),

  isTokenValid: () => {
    const { accessToken, tokenExpiry } = get();
    return Boolean(accessToken && tokenExpiry && Date.now() < tokenExpiry);
  },
}));
