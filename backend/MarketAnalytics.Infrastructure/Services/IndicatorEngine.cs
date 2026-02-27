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
