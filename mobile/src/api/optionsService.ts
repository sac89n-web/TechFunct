import axiosClient from './axiosClient';
import type {
  OptionIndex,
  OptionChainResult,
  OptionStrategy,
  OptionsMarketMetrics,
  OptionStrategyRequest,
} from '../types';

export const optionsService = {
  /** Available option indices */
  getIndices: async (): Promise<OptionIndex[]> => {
    const { data } = await axiosClient.get<OptionIndex[]>('/api/options/indices');
    return data;
  },

  /** Available expiry dates for an index */
  getExpiries: async (index: string): Promise<string[]> => {
    const { data } = await axiosClient.get<string[]>(`/api/options/expiries/${index}`);
    return data;
  },

  /** Full option chain with Greeks */
  getChain: async (index: string, expiry: string): Promise<OptionChainResult> => {
    const { data } = await axiosClient.get<OptionChainResult>('/api/options/chain', {
      params: { index, expiry },
    });
    return data;
  },

  /** Generate and rank top-N option strategies */
  getTopStrategies: async (request: OptionStrategyRequest): Promise<OptionStrategy[]> => {
    const { data } = await axiosClient.post<OptionStrategy[]>(
      '/api/options/strategies/top',
      request,
    );
    return data;
  },

  /** Get a previously generated strategy by UUID */
  getStrategy: async (id: string): Promise<OptionStrategy> => {
    const { data } = await axiosClient.get<OptionStrategy>(`/api/options/strategy/${id}`);
    return data;
  },

  /** Market metrics for nearest expiry */
  getMetrics: async (index: string): Promise<OptionsMarketMetrics> => {
    const { data } = await axiosClient.get<OptionsMarketMetrics>('/api/options/metrics', {
      params: { index },
    });
    return data;
  },

  /** Sync NFO/BFO option instruments */
  syncInstruments: async (): Promise<{ message: string }> => {
    const { data } = await axiosClient.post<{ message: string }>('/api/options/sync');
    return data;
  },
};
