import axiosClient from './axiosClient';
import type { SessionStatus } from '../types';

export const authService = {
  /** Get Kite OAuth login URL */
  getLoginUrl: async (): Promise<string> => {
    const { data } = await axiosClient.get<{ loginUrl: string }>('/api/auth/login-url');
    return data.loginUrl;
  },

  /** Check if session is active on backend */
  getSession: async (): Promise<SessionStatus> => {
    const { data } = await axiosClient.get<SessionStatus>('/api/auth/session');
    return data;
  },

  /** Exchange request_token from Kite OAuth callback */
  generateSession: async (requestToken: string): Promise<void> => {
    await axiosClient.post('/api/auth/session', { requestToken });
  },

  /** Validate the current access token */
  validateToken: async (): Promise<boolean> => {
    try {
      const { data } = await axiosClient.get<{ isValid: boolean }>('/api/auth/validate');
      return data.isValid;
    } catch {
      return false;
    }
  },

  /** Logout — invalidates server-side session */
  logout: async (): Promise<void> => {
    await axiosClient.post('/api/auth/logout');
  },
};
