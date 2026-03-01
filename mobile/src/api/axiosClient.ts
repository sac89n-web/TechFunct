import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import EncryptedStorage from 'react-native-encrypted-storage';
import { Config } from '../config';

const axiosClient = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Session helpers ───────────────────────────────────────────────────────
export async function saveSession(data: object): Promise<void> {
  await EncryptedStorage.setItem(Config.SESSION_KEY, JSON.stringify(data));
}

export async function clearSession(): Promise<void> {
  await EncryptedStorage.removeItem(Config.SESSION_KEY);
}

export async function loadSession(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await EncryptedStorage.getItem(Config.SESSION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ── Request interceptor ───────────────────────────────────────────────────
axiosClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // The backend uses server-side Kite session (cookie / DB), not Bearer tokens.
    // If future JWT auth is added, inject here.
    return config;
  },
  error => Promise.reject(error),
);

// ── Response interceptor ──────────────────────────────────────────────────
axiosClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Session expired — clear local state
      await clearSession();
    }
    return Promise.reject(error);
  },
);

export default axiosClient;
