import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Signature {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
}

interface SettingsState {
  signatures: Signature[];
  addSignature: (name: string, body: string) => void;
  updateSignature: (id: string, updates: Partial<Pick<Signature, 'name' | 'body'>>) => void;
  deleteSignature: (id: string) => void;
  setDefault: (id: string) => void;
  getDefault: () => Signature | null;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      signatures: [],

      addSignature: (name, body) => {
        const isFirst = get().signatures.length === 0;
        set(s => ({
          signatures: [
            ...s.signatures,
            { id: `sig_${Date.now()}`, name, body, isDefault: isFirst },
          ],
        }));
      },

      updateSignature: (id, updates) =>
        set(s => ({
          signatures: s.signatures.map(sig =>
            sig.id === id ? { ...sig, ...updates } : sig
          ),
        })),

      deleteSignature: (id) =>
        set(s => {
          const remaining = s.signatures.filter(sig => sig.id !== id);
          // If we deleted the default, promote the first remaining one
          if (remaining.length > 0 && !remaining.some(sig => sig.isDefault)) {
            remaining[0].isDefault = true;
          }
          return { signatures: remaining };
        }),

      setDefault: (id) =>
        set(s => ({
          signatures: s.signatures.map(sig => ({ ...sig, isDefault: sig.id === id })),
        })),

      getDefault: () => {
        const sigs = get().signatures;
        return sigs.find(s => s.isDefault) ?? sigs[0] ?? null;
      },
    }),
    { name: 'sunlite-settings' }
  )
);
