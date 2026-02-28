import axios from 'axios';
import { HeatmapItem, MomentumItem, StockAnalysis, MarketBreadth, StrategyRanking, IndexQuote } from '../types';

const API_BASE = '/api';

export const authApi = {
  getSession: async (): Promise<{ isAuthenticated: boolean }> => {
    const response = await axios.get(`${API_BASE}/auth/session`);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await axios.post(`${API_BASE}/auth/logout`);
  }
};

export const marketApi = {
  getHeatmap: async (index: string = 'NIFTY50'): Promise<HeatmapItem[]> => {
    const response = await axios.get(`${API_BASE}/market/heatmap?index=${index}`);
    return response.data;
  },

  getMomentum: async (index: string = 'NIFTY50'): Promise<MomentumItem[]> => {
    const response = await axios.get(`${API_BASE}/market/momentum?index=${index}`);
    return response.data;
  },

  getBreadth: async (index: string = 'NIFTY50'): Promise<MarketBreadth> => {
    const response = await axios.get(`${API_BASE}/market/breadth?index=${index}`);
    return response.data;
  },

  analyzeStock: async (symbol: string): Promise<StockAnalysis> => {
    const response = await axios.get(`${API_BASE}/stock/analyze?symbol=${symbol}`);
    return response.data;
  },

  analyzeIndex: async (index: string): Promise<StockAnalysis[]> => {
    const response = await axios.get(`${API_BASE}/stock/analyze-index?index=${encodeURIComponent(index)}`);
    return response.data;
  },

  getIndexQuotes: async (): Promise<IndexQuote[]> => {
    const response = await axios.get(`${API_BASE}/market/index-quotes`);
    return response.data;
  }
};

export const instrumentApi = {
  syncInstruments: async (): Promise<{ message: string }> => {
    const response = await axios.post(`${API_BASE}/market/sync-instruments`);
    return response.data;
  },

  getIndices: async (): Promise<{ value: string; label: string }[]> => {
    const response = await axios.get(`${API_BASE}/market/indices`);
    return response.data;
  }
};

export const strategiesApi = {
  getTop10: async (index: string = 'NIFTY50'): Promise<StrategyRanking[]> => {
    const response = await axios.get(`${API_BASE}/strategies/top10?index=${encodeURIComponent(index)}`);
    return response.data;
  }
};
