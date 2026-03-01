import { useEffect, useRef, useCallback, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import type { OptionChainResult } from '../types/options';

const HUB_URL = (import.meta.env.VITE_API_BASE || '').replace('/api', '') + '/hubs/options';
const REFRESH_INTERVAL_MS = 30_000;

interface UseOptionsSocketResult {
  chain: OptionChainResult | null;
  error: string | null;
  isConnected: boolean;
  refresh: () => void;
}

export function useOptionsSocket(
  indexName: string,
  expiry: string,
  enabled: boolean = true,
): UseOptionsSocketResult {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const [chain,       setChain]       = useState<OptionChainResult | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const refresh = useCallback(() => {
    const conn = connectionRef.current;
    if (conn?.state === signalR.HubConnectionState.Connected && indexName && expiry) {
      conn.invoke('RequestChainRefresh', indexName, expiry).catch(err => {
        setError(String(err));
      });
    }
  }, [indexName, expiry]);

  useEffect(() => {
    if (!enabled || !indexName || !expiry) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    connection.on('ChainUpdated', (data: OptionChainResult) => {
      setChain(data);
      setError(null);
    });

    connection.on('ChainError', (msg: string) => {
      setError(msg);
    });

    connection.onreconnected(() => {
      setIsConnected(true);
      connection.invoke('SubscribeToOptionChain', indexName, expiry).catch(() => null);
      refresh();
    });

    connection.onclose(() => setIsConnected(false));

    connection
      .start()
      .then(() => {
        setIsConnected(true);
        return connection.invoke('SubscribeToOptionChain', indexName, expiry);
      })
      .then(() => {
        refresh(); // immediate first load
        // Set up periodic refresh
        intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);
      })
      .catch(err => {
        setError(String(err));
      });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      connection.invoke('UnsubscribeFromOptionChain', indexName, expiry).catch(() => null);
      connection.stop();
      setIsConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexName, expiry, enabled]);

  return { chain, error, isConnected, refresh };
}
