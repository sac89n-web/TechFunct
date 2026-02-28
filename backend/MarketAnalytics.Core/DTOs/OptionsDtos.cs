using System;
using System.Collections.Generic;

namespace MarketAnalytics.Core.DTOs;

// ─── Requests ──────────────────────────────────────────────────────────────

public class OptionStrategyRequestDto
{
    public string   IndexName     { get; set; } = "NIFTY50";
    public DateOnly Expiry        { get; set; }
    public int      TopN          { get; set; } = 10;
    public string   RiskLevel     { get; set; } = "ALL";      // Low / Medium / High / ALL
    public decimal  CapitalBudget { get; set; } = 500000m;
}

public class BacktestRequestDto
{
    public string StrategyType { get; set; } = string.Empty;
    public string IndexName    { get; set; } = "NIFTY50";
    public int    LookbackDays { get; set; } = 365;
}

// ─── Option Chain ──────────────────────────────────────────────────────────

public class OptionChainEntryDto
{
    public long     InstrumentToken { get; set; }
    public string   TradingSymbol   { get; set; } = string.Empty;
    public decimal  Strike          { get; set; }
    public string   OptionType      { get; set; } = string.Empty; // CE / PE
    public DateOnly Expiry          { get; set; }
    public decimal  LTP             { get; set; }
    public decimal  Bid             { get; set; }
    public decimal  Ask             { get; set; }
    public long     OI              { get; set; }
    public long     OIChange        { get; set; }
    public long     Volume          { get; set; }
    public double?  IV              { get; set; }
    public double?  Delta           { get; set; }
    public double?  Gamma           { get; set; }
    public double?  Theta           { get; set; }
    public double?  Vega            { get; set; }
    public int      LotSize         { get; set; }
    public bool     IvUnavailable   { get; set; }
}

public class OptionChainResultDto
{
    public string                    IndexName     { get; set; } = string.Empty;
    public decimal                   UnderlyingLTP { get; set; }
    public DateOnly                  Expiry        { get; set; }
    public int                       DTE           { get; set; }
    public List<OptionChainEntryDto> Chain         { get; set; } = new();
    public decimal                   PCR           { get; set; }
    public decimal                   MaxPain       { get; set; }
    public double?                   AtmIV         { get; set; }
    public double?                   IVPercentile  { get; set; }
    public double?                   IVSkew        { get; set; }
    public DateTime                  LastUpdated   { get; set; }
    public bool                      DataComplete  { get; set; }
    public string?                   Warning       { get; set; }
}

// ─── Greeks ────────────────────────────────────────────────────────────────

public class GreeksDto
{
    public double Delta { get; set; }
    public double Gamma { get; set; }
    public double Theta { get; set; }
    public double Vega  { get; set; }
}

// ─── Strategy Leg ──────────────────────────────────────────────────────────

public class OptionLegDto
{
    public string   OptionType      { get; set; } = string.Empty; // CALL / PUT
    public string   Action          { get; set; } = string.Empty; // BUY / SELL
    public decimal  Strike          { get; set; }
    public DateOnly Expiry          { get; set; }
    public decimal  EntryPrice      { get; set; }
    public decimal  Bid             { get; set; }
    public decimal  Ask             { get; set; }
    public int      LotSize         { get; set; }
    public int      Lots            { get; set; } = 1;
    public double?  IV              { get; set; }
    public GreeksDto Greeks         { get; set; } = new();
    public long     OI              { get; set; }
    public decimal  BidAskSpread    { get; set; }
    public string   TradingSymbol   { get; set; } = string.Empty;
    public bool     IvUnavailable   { get; set; }
}

// ─── Scoring ───────────────────────────────────────────────────────────────

public class OptionFactorScoresDto
{
    public double TrendAlignment  { get; set; }
    public double IVSuitability   { get; set; }
    public double OIConfirmation  { get; set; }
    public double LiquidityScore  { get; set; }
    public double RiskEfficiency  { get; set; }
    public double GreekStability  { get; set; }
    public double TotalScore      { get; set; }
}

// ─── Risk Scenario ─────────────────────────────────────────────────────────

public class RiskScenarioDto
{
    public string  Label          { get; set; } = string.Empty;
    public decimal UnderlyingMove { get; set; }
    public decimal PnL            { get; set; }
    public decimal IVChange       { get; set; }
}

// ─── Payoff Point ──────────────────────────────────────────────────────────

public class PayoffPointDto
{
    public decimal UnderlyingPrice { get; set; }
    public decimal PnL             { get; set; }
}

// ─── Full Strategy ─────────────────────────────────────────────────────────

public class OptionStrategyDto
{
    public Guid                    StrategyId          { get; set; }
    public int                     Rank                { get; set; }
    public string                  Name                { get; set; } = string.Empty;
    public string                  StrategyType        { get; set; } = string.Empty;
    public string                  Bias                { get; set; } = string.Empty;
    public double                  Confidence          { get; set; }
    public string                  RiskLevel           { get; set; } = string.Empty;
    public List<OptionLegDto>      Legs                { get; set; } = new();
    public GreeksDto               NetGreeks           { get; set; } = new();
    public decimal                 MaxProfit           { get; set; }
    public decimal?                MaxProfitCapped     { get; set; }
    public bool                    IsMaxProfitUnlimited{ get; set; }
    public decimal                 MaxLoss             { get; set; }
    public bool                    IsMaxLossUnlimited  { get; set; }
    public List<decimal>           BreakEvens          { get; set; } = new();
    public decimal                 MarginRequired      { get; set; }
    public double                  RiskReward          { get; set; }
    public double                  ExpectedROI         { get; set; }
    public List<PayoffPointDto>    PayoffCurve         { get; set; } = new();
    public string                  IVCondition         { get; set; } = string.Empty;
    public string                  LiquidityStatus     { get; set; } = string.Empty;
    public string                  StrikeSelectionLogic{ get; set; } = string.Empty;
    public string                  AnalysisSummary     { get; set; } = string.Empty;
    public OptionFactorScoresDto   FactorScores        { get; set; } = new();
    public List<RiskScenarioDto>   RiskScenarios       { get; set; } = new();
    public DateTime                GeneratedAt         { get; set; }
}

// ─── Market Metrics ────────────────────────────────────────────────────────

public class OptionsMarketMetricsDto
{
    public string  IndexName     { get; set; } = string.Empty;
    public decimal UnderlyingLTP { get; set; }
    public decimal ATMStrike     { get; set; }
    public double? AtmIV         { get; set; }
    public double? IVPercentile  { get; set; }
    public decimal PCR           { get; set; }
    public decimal MaxPain       { get; set; }
    public double? IVSkew        { get; set; }
    public string  IVCondition   { get; set; } = string.Empty;
    public int     DTE           { get; set; }
}

// ─── Backtest Result ───────────────────────────────────────────────────────

public class BacktestResultDto
{
    public string  StrategyType  { get; set; } = string.Empty;
    public string  IndexName     { get; set; } = string.Empty;
    public int     TotalTrades   { get; set; }
    public int     WinningTrades { get; set; }
    public double  WinRate       { get; set; }
    public decimal AvgPnL        { get; set; }
    public decimal TotalPnL      { get; set; }
    public decimal MaxDrawdown   { get; set; }
    public double  SharpeRatio   { get; set; }
    public string  Warning       { get; set; } = string.Empty;
}
