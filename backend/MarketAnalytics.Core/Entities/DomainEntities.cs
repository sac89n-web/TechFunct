using System;

namespace MarketAnalytics.Core.Entities;

public class KiteSession
{
    public int Id { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public string? PublicToken { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
    public DateTime ExpiryDate { get; set; }
    public bool IsActive { get; set; }
}

public class InstrumentMaster
{
    public int Id { get; set; }
    public long InstrumentToken { get; set; }
    public string TradingSymbol { get; set; } = string.Empty;
    public string Exchange { get; set; } = string.Empty;
    public string Segment { get; set; } = string.Empty;
    public decimal? TickSize { get; set; }
    public int? LotSize { get; set; }
    public string? Sector { get; set; }
    public string? IndexName { get; set; }
    public decimal? IndexWeight { get; set; }
    public DateTime LastUpdated { get; set; }
}

public class StockPriceHistory
{
    public long Id { get; set; }
    public long InstrumentToken { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public DateTime TradeDate { get; set; }
    public decimal Open { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal Close { get; set; }
    public long Volume { get; set; }
    public string Interval { get; set; } = string.Empty;
    public string Source { get; set; } = "KITE";
    public DateTime CreatedDate { get; set; }
}

public class TechnicalIndicators
{
    public long Id { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public long InstrumentToken { get; set; }
    public DateTime CalculationDate { get; set; }
    public decimal? LTP { get; set; }
    public decimal? SMA20 { get; set; }
    public decimal? SMA50 { get; set; }
    public decimal? SMA200 { get; set; }
    public decimal? RSI14 { get; set; }
    public decimal? BBUpper { get; set; }
    public decimal? BBMiddle { get; set; }
    public decimal? BBLower { get; set; }
    public decimal? VolumeRatio { get; set; }
    public decimal? DistanceFromSMA20 { get; set; }
    public decimal? DistanceFromSMA50 { get; set; }
    public decimal? DistanceFromSMA200 { get; set; }
    public bool? IsGoldenCross { get; set; }
    public bool? IsDeathCross { get; set; }
    public DateTime LastUpdated { get; set; }
}

public class MarketSnapshot
{
    public int Id { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public long InstrumentToken { get; set; }
    public decimal LTP { get; set; }
    public decimal ChangePercent { get; set; }
    public long Volume { get; set; }
    public decimal? High { get; set; }
    public decimal? Low { get; set; }
    public decimal? Open { get; set; }
    public decimal? PreviousClose { get; set; }
    public string? Sector { get; set; }
    public string? IndexName { get; set; }
    public decimal? IndexWeight { get; set; }
    public DateTime LastUpdated { get; set; }
}

public class MomentumScore
{
    public int Id { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public long InstrumentToken { get; set; }
    public decimal Score { get; set; }
    public string Signal { get; set; } = string.Empty;
    public bool? PriceAboveSMA20 { get; set; }
    public bool? PriceAboveSMA50 { get; set; }
    public string? RSITrend { get; set; }
    public bool? VolumeSpike { get; set; }
    public decimal? BreakoutProximity { get; set; }
    public decimal? SectorStrength { get; set; }
    public DateTime CalculationDate { get; set; }
}

public class MarketBreadth
{
    public int Id { get; set; }
    public string IndexName { get; set; } = string.Empty;
    public int Advances { get; set; }
    public int Declines { get; set; }
    public int Unchanged { get; set; }
    public decimal? AdvanceDeclineRatio { get; set; }
    public DateTime CalculationDate { get; set; }
}
