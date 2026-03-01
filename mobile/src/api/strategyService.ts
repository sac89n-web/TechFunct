import axiosClient from './axiosClient';
import type { StrategyRanking } from '../types';

export const strategyService = {
  /** Top 10 strategy-ranked stocks for an index (47-factor scoring) */
  getTop10: async (index = 'NIFTY50'): Promise<StrategyRanking[]> => {
    const { data } = await axiosClient.get<StrategyRanking[]>('/api/strategies/top10', {
      params: { index },
    });
    return data;
  },
};
