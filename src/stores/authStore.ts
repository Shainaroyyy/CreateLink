import { create } from 'zustand';
import type { User } from '../types/index';
import * as authService from '../services/authService';

interface AuthStore {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  register: (email: string, password: string, role: 'creator' | 'brand', profile?: any) => Promise<User>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  currentUser: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const user = await authService.login(email, password);
    set({ currentUser: user, isAuthenticated: true });
    try { localStorage.setItem('auth.currentUser', JSON.stringify(user)); } catch {}
    return user;
  },

  logout: () => {
    set({ currentUser: null, isAuthenticated: false });
    try { localStorage.removeItem('auth.currentUser'); } catch {}
  },

  register: async (email, password, role, profile) => {
    const user = await authService.register(email, password, role, profile);
    set({ currentUser: user, isAuthenticated: true });
    try { localStorage.setItem('auth.currentUser', JSON.stringify(user)); } catch {}
    return user;
  },

  verifyEmail: async (token) => {
    const user = await authService.verifyEmail(token);
    set({ currentUser: user, isAuthenticated: true });
    try { localStorage.setItem('auth.currentUser', JSON.stringify(user)); } catch {}
  },

  resendVerification: async (email) => {
    await authService.resendVerification(email);
  },

  resetPassword: async (email) => {
    await authService.resetPassword(email);
  },
}));

// Initialize from localStorage (persist session across refresh)
try {
  const raw = localStorage.getItem('auth.currentUser');
  if (raw) {
    const parsed = JSON.parse(raw);
    // hydrate the store
    (useAuthStore as any).setState({ currentUser: parsed, isAuthenticated: true });
  }
} catch (e) {
  // ignore
}