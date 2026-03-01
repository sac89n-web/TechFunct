import { create } from 'zustand';
import { authService } from '../api/authService';
import { clearSession } from '../api/axiosClient';

interface AuthState {
  isAuthenticated: boolean;
  isChecking: boolean;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
  setAuthenticated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>(set => ({
  isAuthenticated: false,
  isChecking: true,

  checkSession: async () => {
    set({ isChecking: true });
    try {
      const { isAuthenticated } = await authService.getSession();
      set({ isAuthenticated, isChecking: false });
    } catch {
      set({ isAuthenticated: false, isChecking: false });
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      await clearSession();
      set({ isAuthenticated: false });
    }
  },

  setAuthenticated: (val: boolean) => set({ isAuthenticated: val }),
}));
