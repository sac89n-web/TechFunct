import axios from 'axios';
import { HeatmapItem, MomentumItem, StockAnalysis, MarketBreadth } from '../types';

const API_BASE = '/api';

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
  }
};
