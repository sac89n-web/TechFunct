import axiosClient from './axiosClient';
import type { StockAnalysis } from '../types';

export const analysisService = {
  /** Analyze a single stock by symbol */
  analyzeStock: async (symbol: string): Promise<StockAnalysis> => {
    const { data } = await axiosClient.get<StockAnalysis>('/api/stock/analyze', {
      params: { symbol: symbol.toUpperCase() },
    });
    return data;
  },

  /** Analyze all constituents of an index */
  analyzeIndex: async (index = 'NIFTY50'): Promise<StockAnalysis[]> => {
    const { data } = await axiosClient.get<StockAnalysis[]>('/api/stock/analyze-index', {
      params: { index },
    });
    return data;
  },
};
