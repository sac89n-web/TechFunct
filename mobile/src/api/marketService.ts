import axiosClient from './axiosClient';
import type { HeatmapItem, MomentumItem, MarketBreadth, IndexQuote } from '../types';

export interface IndexOption {
  value: string;
  label: string;
}

export const marketService = {
  /** Returns all index quotes (9 indices incl. SENSEX, VIX) */
  getIndexQuotes: async (): Promise<IndexQuote[]> => {
    const { data } = await axiosClient.get<IndexQuote[]>('/api/market/index-quotes');
    return data;
  },

  /** Sector heatmap for given index */
  getHeatmap: async (index = 'NIFTY50'): Promise<HeatmapItem[]> => {
    const { data } = await axiosClient.get<HeatmapItem[]>('/api/market/heatmap', {
      params: { index },
    });
    return data;
  },

  /** Momentum scanner for given index */
  getMomentum: async (index = 'NIFTY50'): Promise<MomentumItem[]> => {
    const { data } = await axiosClient.get<MomentumItem[]>('/api/market/momentum', {
      params: { index },
    });
    return data;
  },

  /** Market breadth (A/D ratio) for given index */
  getBreadth: async (index = 'NIFTY50'): Promise<MarketBreadth> => {
    const { data } = await axiosClient.get<MarketBreadth>('/api/market/breadth', {
      params: { index },
    });
    return data;
  },

  /** Available indices list */
  getIndices: async (): Promise<IndexOption[]> => {
    const { data } = await axiosClient.get<IndexOption[]>('/api/market/indices');
    return data;
  },

  /** Trigger full instrument sync (admin) */
  syncInstruments: async (): Promise<{ message: string }> => {
    const { data } = await axiosClient.post<{ message: string }>(
      '/api/market/sync-instruments',
    );
    return data;
  },
};
