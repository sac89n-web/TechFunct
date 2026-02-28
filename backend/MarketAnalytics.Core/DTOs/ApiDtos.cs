using System;
using System.Collections.Generic;

namespace MarketAnalytics.Core.DTOs;

public class HeatmapItemDto
{
    public string Symbol { get; set; } = string.Empty;
    public decimal LTP { get; set; }
    public decimal ChangePercent { get; set; }
    public string? Sector { get; set; }
    public decimal? IndexWeight { get; set; }
    public string ColorCode { get; set; } = string.Empty;
}

public class MomentumItemDto
{
    public string Symbol { get; set; } = string.Empty;
    public decimal LTP { get; set; }
    public decimal ChangePercent { get; set; }
    public decimal? RSI { get; set; }
    public decimal? VolumeRatio { get; set; }
    public decimal? SMA50Distance { get; set; }
    public decimal MomentumScore { get; set; }
    public string Signal { get; set; } = string.Empty;
}

public class StockAnalysisDto
{
    public string Symbol { get; set; } = string.Empty;
    public decimal CurrentPrice { get; set; }
    public decimal ChangePercent { get; set; }
    public decimal? SMA20 { get; set; }
    public decimal? SMA50 { get; set; }
    public decimal? SMA200 { get; set; }
    public bool? DeathCross { get; set; }
    public bool? GoldenCross { get; set; }
    public decimal? RSI { get; set; }
    public string? BBPosition { get; set; }
    public decimal? BBUpper { get; set; }
    public decimal? BBMiddle { get; set; }
    public decimal? BBLower { get; set; }
    public decimal CompositeScore { get; set; }
    public string TradeSignal { get; set; } = string.Empty;
    public decimal? Target1 { get; set; }
    public decimal? Target2 { get; set; }
    public decimal? StopLoss { get; set; }
    public decimal? RiskReward { get; set; }
}

public class MarketBreadthDto
{
    public string IndexName { get; set; } = string.Empty;
    public int Advances { get; set; }
    public int Declines { get; set; }
    public int Unchanged { get; set; }
    public decimal AdvanceDeclineRatio { get; set; }
    public DateTime CalculationDate { get; set; }
}

public class KiteAuthResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string PublicToken { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
}

public class KiteInstrumentDto
{
    public long InstrumentToken { get; set; }
    public string TradingSymbol { get; set; } = string.Empty;
    public string Exchange { get; set; } = string.Empty;
    public string Segment { get; set; } = string.Empty;
    public decimal TickSize { get; set; }
    public int LotSize { get; set; }
}

public class KiteHistoricalDataDto
{
    public DateTime Date { get; set; }
    public decimal Open { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal Close { get; set; }
    public long Volume { get; set; }
}

public class IndexQuoteDto
{
    public string Name { get; set; } = string.Empty;
    public string KiteSymbol { get; set; } = string.Empty;
    public decimal LastPrice { get; set; }
    public decimal Change { get; set; }
    public decimal ChangePercent { get; set; }
    public decimal Open { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal PrevClose { get; set; }
}

public class StrategyFactorDto
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool Passed { get; set; }
    public int Points { get; set; }
    public string ActualValue { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class StrategyRankingDto
{
    public int Rank { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public decimal LTP { get; set; }
    public decimal ChangePercent { get; set; }
    public string? Sector { get; set; }
    public int TotalScore { get; set; }
    public int MaxScore { get; set; }
    public decimal ScorePercent { get; set; }
    public string Signal { get; set; } = string.Empty;
    public string StrategyTag { get; set; } = string.Empty;
    public decimal? RSI { get; set; }
    public decimal? VolumeRatio { get; set; }
    public decimal? MomentumScore { get; set; }
    public decimal? SMA50Distance { get; set; }
    public bool? GoldenCross { get; set; }
    public List<StrategyFactorDto> Factors { get; set; } = new();
}

public class KiteTickDto
{
    public long InstrumentToken { get; set; }
    public decimal LastPrice { get; set; }
    public long Volume { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal Open { get; set; }
    public decimal Change { get; set; }
}
