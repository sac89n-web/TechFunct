using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using MarketAnalytics.Core.Interfaces;
using Microsoft.AspNetCore.SignalR;
using MarketAnalytics.API.Hubs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;

namespace MarketAnalytics.API.BackgroundServices;

public class MarketDataSyncService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MarketDataSyncService> _logger;
    private readonly IHubContext<MarketDataHub> _hubContext;
    private readonly IConfiguration _config;

    public MarketDataSyncService(IServiceProvider serviceProvider, ILogger<MarketDataSyncService> logger,
        IHubContext<MarketDataHub> hubContext, IConfiguration config)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _hubContext = hubContext;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var instrumentService = scope.ServiceProvider.GetRequiredService<IInstrumentService>();
                var indicatorEngine = scope.ServiceProvider.GetRequiredService<IIndicatorEngine>();
                var cache = scope.ServiceProvider.GetRequiredService<IMarketDataCache>();

                var instruments = await instrumentService.GetIndexConstituentsAsync("NIFTY50");
                var symbols = instruments.Select(i => i.TradingSymbol).ToList();

                await indicatorEngine.BatchCalculateIndicatorsAsync(symbols);
                
                await SyncSnapshotsToDatabase(cache);
                await CalculateMomentumScores(symbols);

                await _hubContext.Clients.Group("NIFTY50").SendAsync("MarketUpdate", new { timestamp = DateTime.UtcNow }, stoppingToken);

                _logger.LogInformation("Market data sync completed for {Count} symbols", symbols.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Market data sync failed");
            }

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }

    private async Task SyncSnapshotsToDatabase(IMarketDataCache cache)
    {
        var snapshots = cache.GetAllSnapshots();
        if (!snapshots.Any()) return;

        var connectionString = _config.GetConnectionString("DefaultConnection");
        using var connection = new NpgsqlConnection(connectionString);

        foreach (var snapshot in snapshots.Values)
        {
            await connection.ExecuteAsync(
                @"INSERT INTO market_snapshot (symbol, instrument_token, ltp, change_percent, volume, high, low, open, 
                        sector, index_name, index_weight, last_updated)
                  VALUES (@Symbol, @InstrumentToken, @LTP, @ChangePercent, @Volume, @High, @Low, @Open,
                        @Sector, @IndexName, @IndexWeight, @LastUpdated)
                  ON CONFLICT (symbol) DO UPDATE SET
                    ltp = @LTP, change_percent = @ChangePercent, volume = @Volume,
                    high = @High, low = @Low, open = @Open, last_updated = @LastUpdated",
                snapshot
            );
        }
    }

    private async Task CalculateMomentumScores(List<string> symbols)
    {
        var connectionString = _config.GetConnectionString("DefaultConnection");
        using var connection = new NpgsqlConnection(connectionString);

        foreach (var symbol in symbols)
        {
            var query = @"
                SELECT ms.*, ti.*
                FROM market_snapshot ms
                LEFT JOIN technical_indicators ti ON ms.symbol = ti.symbol
                WHERE ms.symbol = @Symbol";

            var data = await connection.QueryFirstOrDefaultAsync<dynamic>(query, new { Symbol = symbol });
            if (data == null) continue;

            decimal score = 0;
            bool priceAboveSMA20 = data.ltp > data.sma20;
            bool priceAboveSMA50 = data.ltp > data.sma50;

            if (priceAboveSMA20) score += 15;
            if (priceAboveSMA50) score += 20;
            if (data.rsi14 >= 50 && data.rsi14 <= 70) score += 15;
            if (data.volume_ratio > 1.5m) score += 20;
            if (data.distance_from_sma50 >= -2 && data.distance_from_sma50 <= 2) score += 15;
            if (data.is_golden_cross) score += 15;

            string signal = score switch
            {
                > 75 => "STRONG BUY",
                >= 60 => "BUILDING MOMENTUM",
                >= 40 => "WATCHLIST",
                _ => "WEAK"
            };

            await connection.ExecuteAsync(
                @"INSERT INTO momentum_scores (symbol, instrument_token, momentum_score, signal, price_above_sma20,
                        price_above_sma50, calculation_date)
                  VALUES (@Symbol, @InstrumentToken, @Score, @Signal, @PriceAboveSMA20, @PriceAboveSMA50, @CalculationDate)
                  ON CONFLICT (symbol, calculation_date) DO UPDATE SET
                    momentum_score = @Score, signal = @Signal, price_above_sma20 = @PriceAboveSMA20,
                    price_above_sma50 = @PriceAboveSMA50",
                new
                {
                    Symbol = symbol,
                    InstrumentToken = (long)data.instrument_token,
                    Score = score,
                    Signal = signal,
                    PriceAboveSMA20 = priceAboveSMA20,
                    PriceAboveSMA50 = priceAboveSMA50,
                    CalculationDate = DateTime.UtcNow
                }
            );
        }
    }
}
