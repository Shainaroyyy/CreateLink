import { create } from 'zustand';
import type { User } from '../types/index';
import * as authService from '../services/supabaseAuthService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface AuthStore {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  register: (email: string, password: string, role: 'creator' | 'brand', profile?: any) => Promise<User>;
  verifyEmail: (token: string, email?: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  hydrateFromSupabaseSession: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  currentUser: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const user = await authService.login(email, password);
    set({ currentUser: user, isAuthenticated: true });
    return user;
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Supabase logout failed:', error);
    }
    set({ currentUser: null, isAuthenticated: false });
  },

  register: async (email, password, role, profile) => {
    const user = await authService.register(email, password, role, profile);
    set({ currentUser: user, isAuthenticated: true });
    return user;
  },

  verifyEmail: async (token, email) => {
    const user = await authService.verifyEmail(token, email);
    set({ currentUser: user, isAuthenticated: true });
  },

  resendVerification: async (email) => {
    await authService.resendVerification(email);
  },

  resetPassword: async (email) => {
    await authService.resetPassword(email);
  },

  hydrateFromSupabaseSession: async () => {
    if (!isSupabaseConfigured) {
      set({ currentUser: null, isAuthenticated: false });
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        set({ currentUser: null, isAuthenticated: false });
        return;
      }

      const currentUser = await authService.getCurrentUser();
      set({
        currentUser,
        isAuthenticated: Boolean(currentUser),
      });
    } catch (error) {
      console.warn('Failed to hydrate Supabase session:', error);
      set({ currentUser: null, isAuthenticated: false });
    }
  },
}));

if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    const nextUser = user
      ? {
          id: user.id,
          email: user.email ?? '',
          passwordHash: 'supabase-auth',
          role: 'creator',
          verificationStatus: user.email_confirmed_at ? 'verified' : 'unverified',
          emailVerified: Boolean(user.email_confirmed_at),
          createdAt: user.created_at ?? new Date().toISOString(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        }
      : null;

    (useAuthStore as any).setState({
      currentUser: nextUser,
      isAuthenticated: Boolean(user),
    });
  });

  (useAuthStore.getState() as any).hydrateFromSupabaseSession();
}