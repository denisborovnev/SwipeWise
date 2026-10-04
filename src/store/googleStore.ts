import { createStore, type StoreApi } from 'zustand/vanilla';

import type { GoogleAuth } from '@/auth/google';

export interface GoogleAccountState {
  /** 'restoring' while an earlier sign-in is being restored on app start. */
  status: 'idle' | 'restoring' | 'ready';
  /** Email of the signed-in Google account (shown in the app only); null = signed out. */
  email: string | null;

  /** Restores an earlier sign-in silently (no UI); failures just leave the user signed out. */
  restore(): Promise<void>;
  /** Shows Google's sign-in; returns false if the user cancelled. */
  signIn(): Promise<boolean>;
  signOut(): Promise<void>;
}

/** The app-wide Google account (one for all courses). */
export function createGoogleAccountStore(auth: GoogleAuth): StoreApi<GoogleAccountState> {
  return createStore<GoogleAccountState>()((set) => ({
    status: 'idle',
    email: null,

    async restore() {
      set({ status: 'restoring' });
      try {
        set({ status: 'ready', email: await auth.restore() });
      } catch (e) {
        console.warn('Could not restore the Google sign-in', e);
        set({ status: 'ready', email: null });
      }
    },

    async signIn() {
      const email = await auth.signIn();
      if (email) {
        set({ status: 'ready', email });
      }
      return email !== null;
    },

    async signOut() {
      await auth.signOut();
      set({ email: null });
    },
  }));
}
