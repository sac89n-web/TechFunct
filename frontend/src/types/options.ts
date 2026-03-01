// ─── Option Chain ───────────────────────────────────────────────────────────

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionChainEntry {
  instrumentToken: number;
  tradingSymbol: string;
  strike: number;
  optionType: 'CE' | 'PE';
  expiry: string;
  ltp: number;
  bid: number;
  ask: number;
  oi: number;
  oiChange: number;
  volume: number;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  lotSize: number;
  ivUnavailable: boolean;
}

export interface OptionChainResult {
  indexName: string;
  underlyingLTP: number;
  expiry: string;
  dte: number;
  chain: OptionChainEntry[];
  pcr: number;
  maxPain: number;
  atmIV: number | null;
  ivPercentile: number | null;
  ivSkew: number | null;
  lastUpdated: string;
  dataComplete: boolean;
  warning: string | null;
}

// ─── Strategy Leg ───────────────────────────────────────────────────────────

export interface OptionLeg {
  optionType: 'CALL' | 'PUT';
  action: 'BUY' | 'SELL';
  strike: number;
  expiry: string;
  entryPrice: number;
  bid: number;
  ask: number;
  lotSize: number;
  lots: number;
  iv: number | null;
  greeks: Greeks;
  oi: number;
  bidAskSpread: number;
  tradingSymbol: string;
  ivUnavailable: boolean;
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export interface OptionFactorScores {
  trendAlignment: number;
  ivSuitability: number;
  oiConfirmation: number;
  liquidityScore: number;
  riskEfficiency: number;
  greekStability: number;
  totalScore: number;
}

// ─── Risk Scenario ──────────────────────────────────────────────────────────

export interface RiskScenario {
  label: string;
  underlyingMove: number;
  pnL: number;
  ivChange: number;
}

// ─── Payoff Point ───────────────────────────────────────────────────────────

export interface PayoffPoint {
  underlyingPrice: number;
  pnL: number;
}

// ─── Full Strategy ──────────────────────────────────────────────────────────

export type StrategyBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILITY';
export type RiskLevel    = 'Low' | 'Medium' | 'High';
export type IVCondition  = 'IV_HIGH' | 'IV_NORMAL' | 'IV_LOW' | 'UNKNOWN';

export interface OptionStrategy {
  strategyId: string;
  rank: number;
  name: string;
  strategyType: string;
  bias: StrategyBias;
  confidence: number;
  riskLevel: RiskLevel;
  legs: OptionLeg[];
  netGreeks: Greeks;
  maxProfit: number;
  maxProfitCapped: number | null;
  isMaxProfitUnlimited: boolean;
  maxLoss: number;
  isMaxLossUnlimited: boolean;
  breakEvens: number[];
  marginRequired: number;
  riskReward: number;
  expectedROI: number;
  payoffCurve: PayoffPoint[];
  ivCondition: string;
  liquidityStatus: string;
  strikeSelectionLogic: string;
  analysisSummary: string;
  factorScores: OptionFactorScores;
  riskScenarios: RiskScenario[];
  generatedAt: string;
}

// ─── Market Metrics ─────────────────────────────────────────────────────────

export interface OptionsMarketMetrics {
  indexName: string;
  underlyingLTP: number;
  atmStrike: number;
  atmIV: number | null;
  ivPercentile: number | null;
  pcr: number;
  maxPain: number;
  ivSkew: number | null;
  ivCondition: IVCondition;
  dte: number;
}

// ─── Requests ───────────────────────────────────────────────────────────────

export interface OptionStrategyRequest {
  indexName: string;
  expiry: string;         // "yyyy-MM-dd"
  topN: number;
  riskLevel: string;      // "Low" | "Medium" | "High" | "ALL"
  capitalBudget: number;
}

// ─── Index option ───────────────────────────────────────────────────────────

export interface OptionIndex {
  value: string;
  label: string;
  kiteSymbol: string;
}
