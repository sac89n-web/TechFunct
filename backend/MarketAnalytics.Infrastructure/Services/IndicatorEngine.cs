using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using MarketAnalytics.Core.Entities;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace MarketAnalytics.Infrastructure.Services;

public class IndicatorEngine : IIndicatorEngine
{
    private readonly IConfiguration _config;
    private readonly ILogger<IndicatorEngine> _logger;
    private readonly string _connectionString;

    public IndicatorEngine(IConfiguration config, ILogger<IndicatorEngine> logger)
    {
        _config = config;
        _logger = logger;
        _connectionString = config.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException();
    }

    public async Task CalculateIndicatorsAsync(string symbol)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        
        var prices = await connection.QueryAsync<StockPriceHistory>(
            @"SELECT * FROM stock_price_history 
              WHERE symbol = @Symbol AND interval = 'day' 
              ORDER BY trade_date DESC LIMIT 250",
            new { Symbol = symbol }
        );

        var priceList = prices.OrderBy(x => x.TradeDate).ToList();
        if (priceList.Count < 20) return;

        var latest = priceList.Last();
        var closes = priceList.Select(x => x.Close).ToList();
        var volumes = priceList.Select(x => x.Volume).ToList();

        var indicators = new TechnicalIndicators
        {
            Symbol = symbol,
            InstrumentToken = latest.InstrumentToken,
            CalculationDate = latest.TradeDate,
            LTP = latest.Close,
            SMA20 = CalculateSMA(closes, 20),
            SMA50 = CalculateSMA(closes, 50),
            SMA200 = CalculateSMA(closes, 200),
            RSI14 = CalculateRSI(closes, 14),
            VolumeRatio = CalculateVolumeRatio(volumes, 20),
            LastUpdated = DateTime.UtcNow
        };

        var bb = CalculateBollingerBands(closes, 20, 2);
        indicators.BBUpper = bb.Upper;
        indicators.BBMiddle = bb.Middle;
        indicators.BBLower = bb.Lower;

        if (indicators.SMA20.HasValue)
            indicators.DistanceFromSMA20 = ((latest.Close - indicators.SMA20.Value) / indicators.SMA20.Value) * 100;
        
        if (indicators.SMA50.HasValue)
            indicators.DistanceFromSMA50 = ((latest.Close - indicators.SMA50.Value) / indicators.SMA50.Value) * 100;
        
        if (indicators.SMA200.HasValue)
            indicators.DistanceFromSMA200 = ((latest.Close - indicators.SMA200.Value) / indicators.SMA200.Value) * 100;

        indicators.IsGoldenCross = indicators.SMA50 > indicators.SMA200;
        indicators.IsDeathCross = indicators.SMA50 < indicators.SMA200;

        await connection.ExecuteAsync(
            @"INSERT INTO technical_indicators (symbol, instrument_token, calculation_date, ltp, sma20, sma50, sma200, rsi14,
                    bb_upper, bb_middle, bb_lower, volume_ratio, distance_from_sma20, distance_from_sma50,
                    distance_from_sma200, is_golden_cross, is_death_cross, last_updated)
              VALUES (@Symbol, @InstrumentToken, @CalculationDate, @LTP, @SMA20, @SMA50, @SMA200, @RSI14,
                    @BBUpper, @BBMiddle, @BBLower, @VolumeRatio, @DistanceFromSMA20, @DistanceFromSMA50,
                    @DistanceFromSMA200, @IsGoldenCross, @IsDeathCross, @LastUpdated)
              ON CONFLICT (symbol, calculation_date) DO UPDATE SET
                ltp = @LTP, sma20 = @SMA20, sma50 = @SMA50, sma200 = @SMA200, rsi14 = @RSI14,
                bb_upper = @BBUpper, bb_middle = @BBMiddle, bb_lower = @BBLower, volume_ratio = @VolumeRatio,
                distance_from_sma20 = @DistanceFromSMA20, distance_from_sma50 = @DistanceFromSMA50,
                distance_from_sma200 = @DistanceFromSMA200, is_golden_cross = @IsGoldenCross,
                is_death_cross = @IsDeathCross, last_updated = @LastUpdated",
            indicators
        );
    }

    public async Task BatchCalculateIndicatorsAsync(List<string> symbols)
    {
        var tasks = symbols.Select(symbol => CalculateIndicatorsAsync(symbol));
        await Task.WhenAll(tasks);
        _logger.LogInformation("Calculated indicators for {Count} symbols", symbols.Count);
    }

    public async Task<TechnicalIndicators?> GetLatestIndicatorsAsync(string symbol)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        return await connection.QueryFirstOrDefaultAsync<TechnicalIndicators>(
            "SELECT * FROM technical_indicators WHERE symbol = @Symbol ORDER BY calculation_date DESC LIMIT 1",
            new { Symbol = symbol }
        );
    }

    public async Task CalculateMomentumScoresAsync(List<string> symbols)
    {
        using var connection = new NpgsqlConnection(_connectionString);

        foreach (var symbol in symbols)
        {
            var data = await connection.QueryFirstOrDefaultAsync<MomentumCalcRow>(@"
                SELECT
                    ms.instrument_token,
                    ms.ltp,
                    ti.sma20,
                    ti.sma50,
                    ti.rsi14,
                    ti.volume_ratio,
                    ti.distance_from_sma50,
                    COALESCE(ti.is_golden_cross, false) AS is_golden_cross
                FROM market_snapshot ms
                LEFT JOIN (
                    SELECT DISTINCT ON (symbol) *
                    FROM technical_indicators
                    ORDER BY symbol, calculation_date DESC
                ) ti ON ms.symbol = ti.symbol
                WHERE ms.symbol = @Symbol",
                new { Symbol = symbol });

            if (data == null) continue;

            decimal score = 0;
            bool priceAboveSMA20 = data.Sma20.HasValue && data.Ltp > data.Sma20.Value;
            bool priceAboveSMA50 = data.Sma50.HasValue && data.Ltp > data.Sma50.Value;

            if (priceAboveSMA20) score += 15;
            if (priceAboveSMA50) score += 20;
            if (data.Rsi14 >= 50 && data.Rsi14 <= 70) score += 15;
            if (data.VolumeRatio > 1.5m) score += 20;
            if (data.DistanceFromSma50 >= -2 && data.DistanceFromSma50 <= 2) score += 15;
            if (data.IsGoldenCross) score += 15;

            string signal = score switch
            {
                > 75 => "STRONG BUY",
                >= 60 => "BUILDING MOMENTUM",
                >= 40 => "WATCHLIST",
                _ => "WEAK"
            };

            await connection.ExecuteAsync(
                @"INSERT INTO momentum_scores
                    (symbol, instrument_token, momentum_score, signal, price_above_sma20, price_above_sma50, calculation_date)
                  VALUES
                    (@Symbol, @InstrumentToken, @Score, @Signal, @PriceAboveSMA20, @PriceAboveSMA50, @CalculationDate)
                  ON CONFLICT (symbol, calculation_date) DO UPDATE SET
                    momentum_score = @Score, signal = @Signal,
                    price_above_sma20 = @PriceAboveSMA20, price_above_sma50 = @PriceAboveSMA50",
                new
                {
                    Symbol = symbol,
                    InstrumentToken = data.InstrumentToken,
                    Score = score,
                    Signal = signal,
                    PriceAboveSMA20 = priceAboveSMA20,
                    PriceAboveSMA50 = priceAboveSMA50,
                    CalculationDate = DateTime.UtcNow.Date
                });
        }

        _logger.LogInformation("Calculated momentum scores for {Count} symbols", symbols.Count);
    }

    private class MomentumCalcRow
    {
        public long InstrumentToken { get; set; }
        public decimal Ltp { get; set; }
        public decimal? Sma20 { get; set; }
        public decimal? Sma50 { get; set; }
        public decimal? Rsi14 { get; set; }
        public decimal? VolumeRatio { get; set; }
        public decimal? DistanceFromSma50 { get; set; }
        public bool IsGoldenCross { get; set; }
    }

    private static decimal? CalculateSMA(List<decimal> values, int period)
    {
        if (values.Count < period) return null;
        return values.TakeLast(period).Average();
    }

    private static decimal? CalculateRSI(List<decimal> closes, int period)
    {
        if (closes.Count < period + 1) return null;

        var gains = new List<decimal>();
        var losses = new List<decimal>();

        for (int i = closes.Count - period; i < closes.Count; i++)
        {
            var change = closes[i] - closes[i - 1];
            gains.Add(change > 0 ? change : 0);
            losses.Add(change < 0 ? Math.Abs(change) : 0);
        }

        var avgGain = gains.Average();
        var avgLoss = losses.Average();

        if (avgLoss == 0) return 100;
        var rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private static (decimal? Upper, decimal? Middle, decimal? Lower) CalculateBollingerBands(List<decimal> closes, int period, decimal stdDevMultiplier)
    {
        if (closes.Count < period) return (null, null, null);

        var sma = closes.TakeLast(period).Average();
        var variance = closes.TakeLast(period).Select(x => Math.Pow((double)(x - sma), 2)).Average();
        var stdDev = (decimal)Math.Sqrt(variance);

        return (sma + stdDevMultiplier * stdDev, sma, sma - stdDevMultiplier * stdDev);
    }

    private static decimal? CalculateVolumeRatio(List<long> volumes, int period)
    {
        if (volumes.Count < period + 1) return null;
        var currentVolume = volumes.Last();
        var avgVolume = volumes.TakeLast(period).Average();
        return avgVolume > 0 ? (decimal)currentVolume / (decimal)avgVolume : null;
    }
}
