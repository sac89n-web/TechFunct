using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Entities;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace MarketAnalytics.Infrastructure.Services;

public class MarketAnalyticsService : IMarketAnalyticsService
{
    private readonly IConfiguration _config;
    private readonly ILogger<MarketAnalyticsService> _logger;
    private readonly IMarketDataCache _cache;
    private readonly string _connectionString;

    public MarketAnalyticsService(IConfiguration config, ILogger<MarketAnalyticsService> logger, IMarketDataCache cache)
    {
        _config = config;
        _logger = logger;
        _cache = cache;
        _connectionString = config.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException();
    }

    public async Task<List<HeatmapItemDto>> GetHeatmapAsync(string indexName)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        
        var snapshots = await connection.QueryAsync<MarketSnapshot>(
            "SELECT * FROM market_snapshot WHERE index_name = @IndexName",
            new { IndexName = indexName }
        );

        return snapshots.Select(s => new HeatmapItemDto
        {
            Symbol = s.Symbol,
            LTP = s.LTP,
            ChangePercent = s.ChangePercent,
            Sector = s.Sector,
            IndexWeight = s.IndexWeight,
            ColorCode = GetColorCode(s.ChangePercent)
        }).ToList();
    }

    public async Task<List<MomentumItemDto>> GetMomentumScannerAsync(string indexName)
    {
        using var connection = new NpgsqlConnection(_connectionString);

        var query = @"
            SELECT 
                ms.symbol,
                ms.ltp,
                ms.change_percent AS changePercent,
                ti.rsi14 AS rsi,
                ti.volume_ratio AS volumeRatio,
                ti.distance_from_sma50 AS sma50Distance,
                COALESCE(mom.momentum_score, 0) AS momentumScore,
                COALESCE(mom.signal, 'UNKNOWN') AS signal
            FROM market_snapshot ms
            LEFT JOIN technical_indicators ti ON ms.symbol = ti.symbol
            LEFT JOIN momentum_scores mom ON ms.symbol = mom.symbol
            WHERE ms.index_name = @IndexName
            ORDER BY momentumScore DESC";

        var results = await connection.QueryAsync<MomentumItemDto>(query, new { IndexName = indexName });
        return results.ToList();
    }

    public async Task<StockAnalysisDto?> GetStockAnalysisAsync(string symbol)
    {
        using var connection = new NpgsqlConnection(_connectionString);

        var snapshot = await connection.QueryFirstOrDefaultAsync<MarketSnapshot>(
            "SELECT * FROM market_snapshot WHERE symbol = @Symbol",
            new { Symbol = symbol }
        );

        if (snapshot == null) return null;

        var indicators = await connection.QueryFirstOrDefaultAsync<TechnicalIndicators>(
            "SELECT * FROM technical_indicators WHERE symbol = @Symbol ORDER BY calculation_date DESC LIMIT 1",
            new { Symbol = symbol }
        );

        if (indicators == null) return null;

        var compositeScore = CalculateCompositeScore(snapshot, indicators);
        var signal = GetTradeSignal(compositeScore);
        var (target1, target2, stopLoss) = CalculateTargets(snapshot.LTP, indicators);

        return new StockAnalysisDto
        {
            Symbol = symbol,
            CurrentPrice = snapshot.LTP,
            SMA20 = indicators.SMA20,
            SMA50 = indicators.SMA50,
            SMA200 = indicators.SMA200,
            DeathCross = indicators.IsDeathCross,
            GoldenCross = indicators.IsGoldenCross,
            RSI = indicators.RSI14,
            BBPosition = GetBBPosition(snapshot.LTP, indicators),
            BBUpper = indicators.BBUpper,
            BBMiddle = indicators.BBMiddle,
            BBLower = indicators.BBLower,
            CompositeScore = compositeScore,
            TradeSignal = signal,
            Target1 = target1,
            Target2 = target2,
            StopLoss = stopLoss,
            RiskReward = stopLoss.HasValue && target1.HasValue ? (target1.Value - snapshot.LTP) / (snapshot.LTP - stopLoss.Value) : null
        };
    }

    public async Task<MarketBreadthDto?> GetMarketBreadthAsync(string indexName)
    {
        using var connection = new NpgsqlConnection(_connectionString);

        var snapshots = await connection.QueryAsync<MarketSnapshot>(
            "SELECT * FROM market_snapshot WHERE index_name = @IndexName",
            new { IndexName = indexName }
        );

        var advances = snapshots.Count(s => s.ChangePercent > 0);
        var declines = snapshots.Count(s => s.ChangePercent < 0);
        var unchanged = snapshots.Count(s => s.ChangePercent == 0);
        var ratio = declines > 0 ? (decimal)advances / declines : advances;

        var breadth = new MarketBreadthDto
        {
            IndexName = indexName,
            Advances = advances,
            Declines = declines,
            Unchanged = unchanged,
            AdvanceDeclineRatio = ratio,
            CalculationDate = DateTime.UtcNow
        };

        await connection.ExecuteAsync(
            @"INSERT INTO market_breadth (index_name, advances, declines, unchanged, advance_decline_ratio, calculation_date)
              VALUES (@IndexName, @Advances, @Declines, @Unchanged, @AdvanceDeclineRatio, @CalculationDate)",
            breadth
        );

        return breadth;
    }

    private static string GetColorCode(decimal changePercent)
    {
        return changePercent switch
        {
            > 2 => "DarkGreen",
            > 1 => "Green",
            > -1 => "Neutral",
            > -2 => "Orange",
            _ => "Red"
        };
    }

    private static decimal CalculateCompositeScore(MarketSnapshot snapshot, TechnicalIndicators indicators)
    {
        decimal score = 0;

        if (indicators.RSI14.HasValue)
        {
            if (indicators.RSI14 >= 40 && indicators.RSI14 <= 60) score += 20;
            else if (indicators.RSI14 > 60 && indicators.RSI14 <= 70) score += 15;
            else if (indicators.RSI14 >= 30 && indicators.RSI14 < 40) score += 10;
        }

        if (snapshot.LTP > indicators.SMA20 && snapshot.LTP > indicators.SMA50) score += 20;
        else if (snapshot.LTP > indicators.SMA20) score += 10;

        if (indicators.BBMiddle.HasValue && indicators.BBUpper.HasValue && indicators.BBLower.HasValue)
        {
            if (snapshot.LTP >= indicators.BBMiddle && snapshot.LTP <= indicators.BBUpper) score += 20;
            else if (snapshot.LTP > indicators.BBUpper) score += 10;
        }

        if (indicators.IsGoldenCross == true) score += 20;

        if (indicators.VolumeRatio > 1.5m) score += 20;
        else if (indicators.VolumeRatio > 1.0m) score += 10;

        return Math.Min(score, 100);
    }

    private static string GetTradeSignal(decimal compositeScore)
    {
        return compositeScore switch
        {
            >= 75 => "STRONG BUY",
            >= 60 => "BUY",
            >= 40 => "HOLD",
            >= 25 => "WEAK",
            _ => "AVOID"
        };
    }

    private static string? GetBBPosition(decimal ltp, TechnicalIndicators indicators)
    {
        if (!indicators.BBUpper.HasValue || !indicators.BBMiddle.HasValue || !indicators.BBLower.HasValue)
            return null;

        if (ltp > indicators.BBUpper) return "Above Upper Band";
        if (ltp < indicators.BBLower) return "Below Lower Band";
        if (ltp > indicators.BBMiddle) return "Above Middle";
        return "Below Middle";
    }

    private static (decimal? Target1, decimal? Target2, decimal? StopLoss) CalculateTargets(decimal ltp, TechnicalIndicators indicators)
    {
        decimal? target1 = ltp * 1.05m;
        decimal? target2 = ltp * 1.10m;
        decimal? stopLoss = indicators.SMA20 ?? ltp * 0.95m;

        return (target1, target2, stopLoss);
    }
}
