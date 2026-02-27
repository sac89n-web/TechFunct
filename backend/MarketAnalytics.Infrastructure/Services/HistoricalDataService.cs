using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Dapper;
using MarketAnalytics.Core.Entities;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Npgsql;

namespace MarketAnalytics.Infrastructure.Services;

public class HistoricalDataService : IHistoricalDataService
{
    private readonly IConfiguration _config;
    private readonly ILogger<HistoricalDataService> _logger;
    private readonly IKiteConnectService _kiteService;
    private readonly string _connectionString;
    private readonly HttpClient _httpClient;

    public HistoricalDataService(IConfiguration config, ILogger<HistoricalDataService> logger,
        IKiteConnectService kiteService, IHttpClientFactory httpClientFactory)
    {
        _config = config;
        _logger = logger;
        _kiteService = kiteService;
        _connectionString = config.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException();
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task SyncHistoricalDataAsync(long instrumentToken, string symbol, string interval, DateTime from, DateTime to)
    {
        var accessToken = await _kiteService.GetActiveAccessTokenAsync();
        if (string.IsNullOrEmpty(accessToken))
        {
            _logger.LogWarning("No active access token");
            return;
        }

        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("X-Kite-Version", "3");
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"token {_config["Kite:ApiKey"]}:{accessToken}");

        var fromStr = from.ToString("yyyy-MM-dd");
        var toStr = to.ToString("yyyy-MM-dd");
        var url = $"https://api.kite.trade/instruments/historical/{instrumentToken}/{interval}?from={fromStr}&to={toStr}";

        var response = await _httpClient.GetAsync(url);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Failed to fetch historical data for {Symbol}", symbol);
            return;
        }

        var jsonResponse = await response.Content.ReadAsStringAsync();
        var result = JsonConvert.DeserializeObject<dynamic>(jsonResponse);
        var candles = result?.data?.candles;

        if (candles == null) return;

        var priceHistory = new List<StockPriceHistory>();
        foreach (var candle in candles)
        {
            priceHistory.Add(new StockPriceHistory
            {
                InstrumentToken = instrumentToken,
                Symbol = symbol,
                TradeDate = DateTime.Parse(candle[0].ToString()),
                Open = candle[1],
                High = candle[2],
                Low = candle[3],
                Close = candle[4],
                Volume = candle[5],
                Interval = interval,
                Source = "KITE",
                CreatedDate = DateTime.UtcNow
            });
        }

        using var connection = new NpgsqlConnection(_connectionString);
        foreach (var batch in priceHistory.Chunk(500))
        {
            await connection.ExecuteAsync(
                @"INSERT INTO stock_price_history (instrument_token, symbol, trade_date, open, high, low, close, volume, interval, source, created_date)
                  VALUES (@InstrumentToken, @Symbol, @TradeDate, @Open, @High, @Low, @Close, @Volume, @Interval, @Source, @CreatedDate)
                  ON CONFLICT (instrument_token, trade_date, interval) DO NOTHING",
                batch
            );
        }

        _logger.LogInformation("Synced {Count} candles for {Symbol}", priceHistory.Count, symbol);
    }

    public async Task<List<StockPriceHistory>> GetHistoricalDataAsync(string symbol, string interval, int days)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        var data = await connection.QueryAsync<StockPriceHistory>(
            @"SELECT * FROM stock_price_history 
              WHERE symbol = @Symbol AND interval = @Interval 
              ORDER BY trade_date DESC LIMIT @Days",
            new { Symbol = symbol, Interval = interval, Days = days }
        );
        return data.OrderBy(x => x.TradeDate).ToList();
    }
}
