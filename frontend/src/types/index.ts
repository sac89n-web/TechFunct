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

export interface StockAnalysis {
  symbol: string;
  currentPrice: number;
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

export interface MarketBreadth {
  indexName: string;
  advances: number;
  declines: number;
  unchanged: number;
  advanceDeclineRatio: number;
  calculationDate: string;
}
