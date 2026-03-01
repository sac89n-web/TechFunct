import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

/** Checks session on mount and returns auth state */
export function useAuth() {
  const { isAuthenticated, isChecking, checkSession, logout, setAuthenticated } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, []);

  return { isAuthenticated, isChecking, checkSession, logout, setAuthenticated };
}
