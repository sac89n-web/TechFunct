using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace MarketAnalytics.Infrastructure.Services;

public class StrategyService : IStrategyService
{
    private readonly string _connectionString;
    private readonly IInstrumentService _instrumentService;
    private readonly ILogger<StrategyService> _logger;

    public StrategyService(
        IConfiguration config,
        IInstrumentService instrumentService,
        ILogger<StrategyService> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Missing connection string");
        _instrumentService = instrumentService;
        _logger = logger;
    }

    public async Task<List<StrategyRankingDto>> GetTop10StrategiesAsync(string indexName = "NIFTY50")
    {
        var symbols = await _instrumentService.GetIndexSymbolsAsync(indexName);
        if (symbols.Count == 0) return new List<StrategyRankingDto>();

        using var conn = new NpgsqlConnection(_connectionString);

        var rows = await conn.QueryAsync<StrategyDataRow>(@"
            SELECT
                ms.symbol,
                ms.ltp,
                ms.change_percent,
                ms.open,
                ms.high,
                ms.low,
                ms.sector,
                ti.sma20,
                ti.sma50,
                ti.sma200,
                ti.rsi14,
                ti.bb_upper,
                ti.bb_middle,
                ti.bb_lower,
                ti.volume_ratio,
                ti.distance_from_sma50,
                ti.is_golden_cross,
                ti.is_death_cross,
                COALESCE(mom.momentum_score, 0) AS momentum_score,
                COALESCE(mom.signal, 'UNKNOWN') AS signal
            FROM market_snapshot ms
            LEFT JOIN (
                SELECT DISTINCT ON (symbol) *
                FROM technical_indicators
                ORDER BY symbol, calculation_date DESC
            ) ti ON ms.symbol = ti.symbol
            LEFT JOIN (
                SELECT DISTINCT ON (symbol) *
                FROM momentum_scores
                ORDER BY symbol, calculation_date DESC
            ) mom ON ms.symbol = mom.symbol
            WHERE ms.symbol = ANY(@Symbols)",
            new { Symbols = symbols.ToArray() });

        var ranked = rows
            .Select(r => ScoreStock(r))
            .OrderByDescending(s => s.TotalScore)
            .Take(10)
            .ToList();

        for (int i = 0; i < ranked.Count; i++)
            ranked[i].Rank = i + 1;

        return ranked;
    }

    private static StrategyRankingDto ScoreStock(StrategyDataRow r)
    {
        var factors = new List<StrategyFactorDto>();

        // ── Category 1: Trend Analysis (8 factors, 2 pts each = 16 pts max) ──
        AddFactor(factors, "Price > SMA20", "Trend",
            r.Sma20.HasValue && r.Ltp > r.Sma20,
            2, FormatPrice(r.Ltp, r.Sma20),
            "LTP is above the 20-day moving average — short-term bullish");

        AddFactor(factors, "Price > SMA50", "Trend",
            r.Sma50.HasValue && r.Ltp > r.Sma50,
            2, FormatPrice(r.Ltp, r.Sma50),
            "LTP is above the 50-day moving average — medium-term bullish");

        AddFactor(factors, "Price > SMA200", "Trend",
            r.Sma200.HasValue && r.Ltp > r.Sma200,
            2, FormatPrice(r.Ltp, r.Sma200),
            "LTP is above the 200-day moving average — long-term bullish");

        AddFactor(factors, "SMA20 > SMA50", "Trend",
            r.Sma20.HasValue && r.Sma50.HasValue && r.Sma20 > r.Sma50,
            2, FormatTwoValues(r.Sma20, r.Sma50),
            "Short-term average above medium-term — uptrend alignment");

        AddFactor(factors, "SMA50 > SMA200", "Trend",
            r.Sma50.HasValue && r.Sma200.HasValue && r.Sma50 > r.Sma200,
            2, FormatTwoValues(r.Sma50, r.Sma200),
            "Medium-term average above long-term — bullish macro trend");

        AddFactor(factors, "Golden Cross Active", "Trend",
            r.IsGoldenCross == true,
            2, r.IsGoldenCross == true ? "Yes" : "No",
            "SMA50 recently crossed above SMA200 — strong bullish signal");

        AddFactor(factors, "No Death Cross", "Trend",
            r.IsDeathCross != true,
            2, r.IsDeathCross == true ? "Death Cross!" : "Clear",
            "SMA50 has not crossed below SMA200 — no bearish crossover");

        AddFactor(factors, "Triple SMA Alignment", "Trend",
            r.Sma20.HasValue && r.Sma50.HasValue && r.Sma200.HasValue &&
            r.Ltp > r.Sma20 && r.Ltp > r.Sma50 && r.Ltp > r.Sma200,
            2, r.Sma20.HasValue ? "All aligned" : "Incomplete",
            "Price above all 3 moving averages — full bullish alignment");

        // ── Category 2: RSI / Momentum (7 factors, 2 pts each = 14 pts max) ──
        AddFactor(factors, "RSI > 50 (Bullish)", "Momentum",
            r.Rsi14.HasValue && r.Rsi14 > 50,
            2, r.Rsi14.HasValue ? $"{r.Rsi14:F1}" : "N/A",
            "RSI above 50 indicates bullish momentum");

        AddFactor(factors, "RSI in 50–70 Zone", "Momentum",
            r.Rsi14.HasValue && r.Rsi14 >= 50 && r.Rsi14 <= 70,
            2, r.Rsi14.HasValue ? $"{r.Rsi14:F1}" : "N/A",
            "RSI in 50-70 = ideal bullish zone without being overbought");

        AddFactor(factors, "RSI Not Overbought", "Momentum",
            !r.Rsi14.HasValue || r.Rsi14 < 80,
            2, r.Rsi14.HasValue ? $"{r.Rsi14:F1}" : "N/A",
            "RSI below 80 — not in dangerous overbought territory");

        AddFactor(factors, "RSI Not Oversold", "Momentum",
            !r.Rsi14.HasValue || r.Rsi14 >= 30,
            2, r.Rsi14.HasValue ? $"{r.Rsi14:F1}" : "N/A",
            "RSI at or above 30 — not in oversold territory");

        AddFactor(factors, "Momentum Score > 60", "Momentum",
            r.MomentumScore >= 60,
            2, $"{r.MomentumScore:F0}",
            "Composite momentum score above 60 = strong momentum");

        AddFactor(factors, "Momentum Score > 40", "Momentum",
            r.MomentumScore >= 40,
            2, $"{r.MomentumScore:F0}",
            "Composite momentum score above 40 = decent momentum");

        AddFactor(factors, "Signal: STRONG BUY", "Momentum",
            r.Signal == "STRONG BUY",
            2, r.Signal,
            "System-generated signal is STRONG BUY — highest conviction");

        // ── Category 3: Volume Analysis (5 factors, 2 pts each = 10 pts max) ──
        AddFactor(factors, "Volume Ratio > 1.0x", "Volume",
            r.VolumeRatio.HasValue && r.VolumeRatio > 1.0m,
            2, r.VolumeRatio.HasValue ? $"{r.VolumeRatio:F2}x" : "N/A",
            "Today's volume above 20-day average — participation confirmed");

        AddFactor(factors, "Volume Ratio > 1.5x", "Volume",
            r.VolumeRatio.HasValue && r.VolumeRatio > 1.5m,
            2, r.VolumeRatio.HasValue ? $"{r.VolumeRatio:F2}x" : "N/A",
            "Volume 50% above average — strong institutional interest");

        AddFactor(factors, "Volume Ratio > 2.0x", "Volume",
            r.VolumeRatio.HasValue && r.VolumeRatio > 2.0m,
            2, r.VolumeRatio.HasValue ? $"{r.VolumeRatio:F2}x" : "N/A",
            "Volume double the average — very high conviction move");

        AddFactor(factors, "Volume Confirms Price Rise", "Volume",
            r.VolumeRatio.HasValue && r.VolumeRatio > 1.0m && r.ChangePercent > 0,
            2, r.VolumeRatio.HasValue ? $"{r.VolumeRatio:F2}x / +{r.ChangePercent:F2}%" : "N/A",
            "Rising price with above-average volume — bullish confirmation");

        AddFactor(factors, "No Low Volume Alert", "Volume",
            !r.VolumeRatio.HasValue || r.VolumeRatio >= 0.5m,
            2, r.VolumeRatio.HasValue ? $"{r.VolumeRatio:F2}x" : "N/A",
            "Volume not critically low — liquid enough to trade");

        // ── Category 4: Price Action (5 factors, 2 pts each = 10 pts max) ──
        AddFactor(factors, "Positive Day Change", "Price Action",
            r.ChangePercent > 0,
            2, $"{r.ChangePercent:+0.00;-0.00}%",
            "Stock is green today — positive price action");

        AddFactor(factors, "Change > +1%", "Price Action",
            r.ChangePercent > 1,
            2, $"{r.ChangePercent:+0.00;-0.00}%",
            "Notable gain of more than 1% today");

        AddFactor(factors, "Change > +2%", "Price Action",
            r.ChangePercent > 2,
            2, $"{r.ChangePercent:+0.00;-0.00}%",
            "Strong daily gain exceeding 2%");

        AddFactor(factors, "Not Excessive Gap Up (< +5%)", "Price Action",
            r.ChangePercent < 5,
            2, $"{r.ChangePercent:+0.00;-0.00}%",
            "Move below 5% — not an unsustainable gap");

        AddFactor(factors, "Not Gap Down (> -2%)", "Price Action",
            r.ChangePercent > -2,
            2, $"{r.ChangePercent:+0.00;-0.00}%",
            "Not gapping down more than 2% — no sharp sell-off");

        // ── Category 5: Bollinger Bands (5 factors, 2 pts each = 10 pts max) ──
        AddFactor(factors, "Price Above BB Middle", "Bollinger Bands",
            r.BbMiddle.HasValue && r.Ltp > r.BbMiddle,
            2, r.BbMiddle.HasValue ? $"₹{r.Ltp:F2} vs ₹{r.BbMiddle:F2}" : "N/A",
            "LTP above BB midline (SMA20) — in upper half of band");

        AddFactor(factors, "Price Below BB Upper", "Bollinger Bands",
            r.BbUpper.HasValue && r.Ltp < r.BbUpper,
            2, r.BbUpper.HasValue ? $"₹{r.Ltp:F2} vs ₹{r.BbUpper:F2}" : "N/A",
            "Room to run before hitting upper Bollinger band resistance");

        AddFactor(factors, "Price Above BB Lower", "Bollinger Bands",
            r.BbLower.HasValue && r.Ltp > r.BbLower,
            2, r.BbLower.HasValue ? $"₹{r.Ltp:F2} vs ₹{r.BbLower:F2}" : "N/A",
            "Not broken below BB lower band — support intact");

        AddFactor(factors, "In Upper BB Half", "Bollinger Bands",
            r.BbMiddle.HasValue && r.BbUpper.HasValue && r.Ltp >= r.BbMiddle && r.Ltp <= r.BbUpper,
            2, r.BbMiddle.HasValue ? $"₹{r.Ltp:F2}" : "N/A",
            "Price in the sweet spot: above middle, below upper band");

        AddFactor(factors, "BB Data Available", "Bollinger Bands",
            r.BbUpper.HasValue && r.BbMiddle.HasValue && r.BbLower.HasValue,
            2, r.BbUpper.HasValue ? "Available" : "No data",
            "Bollinger Band data exists for this symbol");

        // ── Category 6: SMA Distance / Extension (4 factors, 2 pts each = 8 pts max) ──
        AddFactor(factors, "SMA50 Distance > 0%", "SMA Extension",
            r.DistanceFromSma50.HasValue && r.DistanceFromSma50 > 0,
            2, r.DistanceFromSma50.HasValue ? $"{r.DistanceFromSma50:+0.00;-0.00}%" : "N/A",
            "Price above SMA50 — positive distance indicates bullish bias");

        AddFactor(factors, "SMA50 Distance < 10%", "SMA Extension",
            !r.DistanceFromSma50.HasValue || (r.DistanceFromSma50 > 0 && r.DistanceFromSma50 < 10),
            2, r.DistanceFromSma50.HasValue ? $"{r.DistanceFromSma50:+0.00;-0.00}%" : "N/A",
            "Not overly extended above SMA50 — sustainable trend");

        AddFactor(factors, "SMA50 Distance < 20%", "SMA Extension",
            !r.DistanceFromSma50.HasValue || r.DistanceFromSma50 < 20,
            2, r.DistanceFromSma50.HasValue ? $"{r.DistanceFromSma50:+0.00;-0.00}%" : "N/A",
            "Within 20% of SMA50 — not dangerously extended");

        AddFactor(factors, "SMA50 Data Available", "SMA Extension",
            r.DistanceFromSma50.HasValue,
            2, r.DistanceFromSma50.HasValue ? $"{r.DistanceFromSma50:F2}%" : "No data",
            "SMA50 distance calculated — technical data complete");

        // ── Category 7: Risk / Reward (5 factors, 2 pts each = 10 pts max) ──
        var stopLoss = r.Sma50 ?? r.Ltp * 0.95m;
        var riskPct  = r.Ltp > 0 ? ((r.Ltp - stopLoss) / r.Ltp) * 100 : 0;
        var target1  = r.Ltp * 1.05m;
        var target2  = r.Ltp * 1.10m;
        var rr       = riskPct > 0 ? 5m / riskPct : 0;

        AddFactor(factors, "Stop-Loss < 10% Away", "Risk/Reward",
            riskPct < 10,
            2, $"{riskPct:F2}% risk",
            "Stop-loss distance manageable — controlled risk");

        AddFactor(factors, "Stop-Loss < 5% Away", "Risk/Reward",
            riskPct < 5,
            2, $"{riskPct:F2}% risk",
            "Tight stop-loss — excellent risk control");

        AddFactor(factors, "Target1 (+5%) Achievable", "Risk/Reward",
            rr > 0.5m,
            2, $"T1: ₹{target1:F2}",
            "5% target is reasonable given current momentum");

        AddFactor(factors, "Target2 (+10%) Visible", "Risk/Reward",
            r.MomentumScore >= 50,
            2, $"T2: ₹{target2:F2}",
            "10% target plausible given momentum score > 50");

        AddFactor(factors, "R:R Ratio > 1.5", "Risk/Reward",
            rr > 1.5m,
            2, $"{rr:F2}:1",
            "Risk-reward ratio above 1.5:1 — favorable trade setup");

        // ── Category 8: Signal Confirmation (8 factors, 2 pts each = 16 pts max) ──
        AddFactor(factors, "Signal Not UNKNOWN", "Signal",
            r.Signal != "UNKNOWN",
            2, r.Signal,
            "System has generated a definitive signal for this stock");

        AddFactor(factors, "Signal Not WEAK", "Signal",
            r.Signal != "WEAK" && r.Signal != "UNKNOWN",
            2, r.Signal,
            "Signal is not in weak/negative territory");

        AddFactor(factors, "Signal: BUILDING or Better", "Signal",
            r.Signal == "BUILDING MOMENTUM" || r.Signal == "STRONG BUY",
            2, r.Signal,
            "Signal indicates building momentum or strong buy");

        AddFactor(factors, "Score > 40", "Signal",
            r.MomentumScore >= 40,
            2, $"{r.MomentumScore:F0}/100",
            "Momentum composite score above 40 — acceptable");

        AddFactor(factors, "Score > 60", "Signal",
            r.MomentumScore >= 60,
            2, $"{r.MomentumScore:F0}/100",
            "Momentum composite score above 60 — strong");

        AddFactor(factors, "Score > 75", "Signal",
            r.MomentumScore >= 75,
            2, $"{r.MomentumScore:F0}/100",
            "Momentum composite score above 75 — exceptional");

        AddFactor(factors, "Multi-Factor Alignment", "Signal",
            (r.Rsi14 > 50 ? 1 : 0) +
            (r.DistanceFromSma50 > 0 ? 1 : 0) +
            (r.VolumeRatio > 1.2m ? 1 : 0) +
            (r.ChangePercent > 0 ? 1 : 0) >= 3,
            2, "≥3/4 aligned",
            "At least 3 of: RSI>50, above SMA50, vol>1.2x, green today");

        AddFactor(factors, "Overall Bullish Bias", "Signal",
            factors.Count(f => f.Passed) > factors.Count(f => !f.Passed),
            2, $"{factors.Count(f => f.Passed)}/{factors.Count} factors passed",
            "More factors are bullish than bearish — net positive bias");

        var totalScore  = factors.Sum(f => f.Passed ? f.Points : 0);
        var maxScore    = factors.Sum(f => f.Points);
        var scorePct    = maxScore > 0 ? (decimal)totalScore / maxScore * 100 : 0;
        var strategyTag = DetermineStrategyTag(r, factors);

        return new StrategyRankingDto
        {
            Symbol        = r.Symbol,
            LTP           = r.Ltp,
            ChangePercent = r.ChangePercent,
            Sector        = r.Sector,
            TotalScore    = totalScore,
            MaxScore      = maxScore,
            ScorePercent  = Math.Round(scorePct, 1),
            Signal        = r.Signal,
            StrategyTag   = strategyTag,
            RSI           = r.Rsi14,
            VolumeRatio   = r.VolumeRatio,
            MomentumScore = r.MomentumScore,
            SMA50Distance = r.DistanceFromSma50,
            GoldenCross   = r.IsGoldenCross,
            Factors       = factors
        };
    }

    private static void AddFactor(List<StrategyFactorDto> list, string name, string category,
        bool passed, int points, string actualValue, string description)
    {
        list.Add(new StrategyFactorDto
        {
            Name        = name,
            Category    = category,
            Passed      = passed,
            Points      = points,
            ActualValue = actualValue,
            Description = description
        });
    }

    private static string DetermineStrategyTag(StrategyDataRow r, List<StrategyFactorDto> factors)
    {
        if (r.IsGoldenCross == true && r.VolumeRatio > 1.5m)
            return "Golden Cross Breakout";
        if (r.MomentumScore >= 75)
            return "High Momentum";
        if (r.Rsi14 >= 50 && r.Rsi14 <= 65 && r.DistanceFromSma50 > 0 && r.DistanceFromSma50 < 8)
            return "Trend Following";
        if (r.VolumeRatio > 2.0m && r.ChangePercent > 1.5m)
            return "Volume Breakout";
        if (r.Sma50.HasValue && r.Ltp > r.Sma50 && r.Sma200.HasValue && r.Ltp > r.Sma200)
            return "Trend Continuation";
        if (r.MomentumScore >= 60)
            return "Momentum Play";
        if (r.Signal == "BUILDING MOMENTUM")
            return "Emerging Momentum";
        return "Watchlist";
    }

    private static string FormatPrice(decimal ltp, decimal? sma)
        => sma.HasValue ? $"₹{ltp:F2} vs ₹{sma:F2}" : "N/A";

    private static string FormatTwoValues(decimal? a, decimal? b)
        => (a.HasValue && b.HasValue) ? $"₹{a:F2} vs ₹{b:F2}" : "N/A";

    private class StrategyDataRow
    {
        public string Symbol { get; set; } = string.Empty;
        public decimal Ltp { get; set; }
        public decimal ChangePercent { get; set; }
        public decimal Open { get; set; }
        public decimal High { get; set; }
        public decimal Low { get; set; }
        public string? Sector { get; set; }
        public decimal? Sma20 { get; set; }
        public decimal? Sma50 { get; set; }
        public decimal? Sma200 { get; set; }
        public decimal? Rsi14 { get; set; }
        public decimal? BbUpper { get; set; }
        public decimal? BbMiddle { get; set; }
        public decimal? BbLower { get; set; }
        public decimal? VolumeRatio { get; set; }
        public decimal? DistanceFromSma50 { get; set; }
        public bool? IsGoldenCross { get; set; }
        public bool? IsDeathCross { get; set; }
        public decimal MomentumScore { get; set; }
        public string Signal { get; set; } = "UNKNOWN";
    }
}
