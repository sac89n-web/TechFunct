// ── Market / Heatmap ──────────────────────────────────────────────────────
export interface HeatmapItem {
  symbol: string;
  ltp: number;
  changePercent: number;
  sector?: string;
  indexWeight?: number;
  colorCode: string;
}

export interface MomentumItem {
  symbol: string;
  ltp: number;
  changePercent: number;
  rsi?: number;
  volumeRatio?: number;
  sma50Distance?: number;
  momentumScore: number;
  signal: string;
}

export interface MarketBreadth {
  indexName: string;
  advances: number;
  declines: number;
  unchanged: number;
  advanceDeclineRatio: number;
  calculationDate: string;
}

export interface IndexQuote {
  name: string;
  kiteSymbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
}

// ── Stock / Analysis ──────────────────────────────────────────────────────
export interface StockAnalysis {
  symbol: string;
  currentPrice: number;
  changePercent: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  deathCross?: boolean;
  goldenCross?: boolean;
  rsi?: number;
  bbPosition?: string;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  compositeScore: number;
  tradeSignal: string;
  target1?: number;
  target2?: number;
  stopLoss?: number;
  riskReward?: number;
}

// ── Strategy Ranking ──────────────────────────────────────────────────────
export interface StrategyFactor {
  name: string;
  category: string;
  passed: boolean;
  points: number;
  actualValue: string;
  description: string;
}

export interface StrategyRanking {
  rank: number;
  symbol: string;
  ltp: number;
  changePercent: number;
  sector?: string;
  totalScore: number;
  maxScore: number;
  scorePercent: number;
  signal: string;
  strategyTag: string;
  rsi?: number;
  volumeRatio?: number;
  momentumScore?: number;
  sma50Distance?: number;
  goldenCross?: boolean;
  factors: StrategyFactor[];
}

// ── Options ───────────────────────────────────────────────────────────────
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

export interface OptionFactorScores {
  trendAlignment: number;
  ivSuitability: number;
  oiConfirmation: number;
  liquidityScore: number;
  riskEfficiency: number;
  greekStability: number;
  totalScore: number;
}

export interface RiskScenario {
  label: string;
  underlyingMove: number;
  pnL: number;
  ivChange: number;
}

export interface PayoffPoint {
  underlyingPrice: number;
  pnL: number;
}

export type StrategyBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILITY';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type IVCondition = 'IV_HIGH' | 'IV_NORMAL' | 'IV_LOW' | 'UNKNOWN';

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

export interface OptionStrategyRequest {
  indexName: string;
  expiry: string;
  topN: number;
  riskLevel: string;
  capitalBudget: number;
}

export interface OptionIndex {
  value: string;
  label: string;
  kiteSymbol: string;
}

// ── AI Assistant ──────────────────────────────────────────────────────────
export interface AIContext {
  currentSymbol?: string;
  compositeScore?: number;
  technicalSummary?: string;
  fundamentalSummary?: string;
  riskMetrics?: string;
  openPositions?: string;
  marketContext?: string;
  userRiskProfile?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  riskLevel?: string;
  suggestedBias?: string;
  timestamp: number;
}

export interface AIRequest {
  question: string;
  context: AIContext;
}

export interface AIResponse {
  answer: string;
  confidence: number;
  riskLevel: string;
  suggestedBias: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export interface SessionStatus {
  isAuthenticated: boolean;
}
