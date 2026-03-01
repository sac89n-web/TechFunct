import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { Config } from '../config';
import type { OptionChainResult } from '../types';

const REFRESH_INTERVAL_MS = Config.OPTIONS_REFRESH_MS;

export function useOptionsSocket(indexName: string, expiry: string) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chain, setChain] = useState<OptionChainResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupKey = `options:${indexName}:${expiry}`;

  const refresh = useCallback(async () => {
    if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) return;
    try {
      await connectionRef.current.invoke('RequestChainRefresh', indexName, expiry);
    } catch {
      // ignore — auto-retry on next tick
    }
  }, [indexName, expiry]);

  useEffect(() => {
    if (!indexName || !expiry) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(Config.OPTIONS_HUB_URL)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ChainUpdated', (data: OptionChainResult) => {
      setChain(data);
      setError(null);
    });

    connection.on('ChainError', (msg: string) => {
      setError(msg);
    });

    connection.onreconnected(async () => {
      setIsConnected(true);
      await connection.invoke('SubscribeToOptionChain', indexName, expiry);
    });
    connection.onclose(() => setIsConnected(false));

    connectionRef.current = connection;

    (async () => {
      try {
        await connection.start();
        setIsConnected(true);
        await connection.invoke('SubscribeToOptionChain', indexName, expiry);
        await connection.invoke('RequestChainRefresh', indexName, expiry);

        timerRef.current = setInterval(() => {
          connection.invoke('RequestChainRefresh', indexName, expiry).catch(() => {});
        }, REFRESH_INTERVAL_MS);
      } catch {
        setIsConnected(false);
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      connection.invoke('UnsubscribeFromOptionChain', indexName, expiry).catch(() => {});
      connection.stop();
      connectionRef.current = null;
    };
  }, [indexName, expiry]);

  return { chain, error, isConnected, refresh };
}
