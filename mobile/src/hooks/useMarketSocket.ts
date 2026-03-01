import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { Config } from '../config';

interface MarketUpdate {
  symbol: string;
  ltp: number;
  changePercent: number;
  volume: number;
}

export function useMarketSocket() {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<MarketUpdate | null>(null);

  const connect = useCallback(async () => {
    if (connectionRef.current) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(Config.MARKET_HUB_URL)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('MarketUpdate', (update: MarketUpdate) => {
      setLastUpdate(update);
    });

    connection.onreconnecting(() => setIsConnected(false));
    connection.onreconnected(() => setIsConnected(true));
    connection.onclose(() => setIsConnected(false));

    connectionRef.current = connection;

    try {
      await connection.start();
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.stop();
      connectionRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  return { isConnected, lastUpdate };
}
