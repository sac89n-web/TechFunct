import axios from 'axios';
import type {
  OptionIndex,
  OptionChainResult,
  OptionStrategy,
  OptionStrategyRequest,
  OptionsMarketMetrics,
} from '../types/options';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const OPTIONS  = `${API_BASE}/options`;

export const optionsApi = {
  // Returns the list of indices that support options trading
  getIndices: async (): Promise<OptionIndex[]> => {
    const r = await axios.get<OptionIndex[]>(`${OPTIONS}/indices`);
    return r.data;
  },

  // Returns available expiry dates for the given index
  getExpiries: async (index: string): Promise<string[]> => {
    const r = await axios.get<string[]>(`${OPTIONS}/expiries/${encodeURIComponent(index)}`);
    return r.data;
  },

  // Returns full option chain (Greeks, PCR, MaxPain, IV metrics)
  getChain: async (index: string, expiry: string): Promise<OptionChainResult> => {
    const r = await axios.get<OptionChainResult>(`${OPTIONS}/chain`, {
      params: { index, expiry },
    });
    return r.data;
  },

  // Returns current market metrics (spot, PCR, MaxPain, ATM IV, DTE)
  getMetrics: async (index: string): Promise<OptionsMarketMetrics> => {
    const r = await axios.get<OptionsMarketMetrics>(`${OPTIONS}/metrics`, {
      params: { index },
    });
    return r.data;
  },

  // Generates and ranks top N option strategies
  getTopStrategies: async (req: OptionStrategyRequest): Promise<OptionStrategy[]> => {
    const r = await axios.post<OptionStrategy[]>(`${OPTIONS}/strategies/top`, req);
    return r.data;
  },

  // Returns a previously generated strategy snapshot by UUID
  getStrategy: async (id: string): Promise<OptionStrategy> => {
    const r = await axios.get<OptionStrategy>(`${OPTIONS}/strategy/${id}`);
    return r.data;
  },

  // Triggers a manual NFO/BFO instrument sync
  syncOptionInstruments: async (): Promise<{ message: string }> => {
    const r = await axios.post<{ message: string }>(`${OPTIONS}/sync`);
    return r.data;
  },
};
