import { useState, useEffect } from 'react';
import { authApi } from '../services/api';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ isAuthenticated: false, isLoading: true });

  useEffect(() => {
    authApi.getSession()
      .then(data => setState({ isAuthenticated: data.isAuthenticated, isLoading: false }))
      .catch(() => setState({ isAuthenticated: false, isLoading: false }));
  }, []);

  return state;
}
