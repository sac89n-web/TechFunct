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
using Npgsql;

namespace MarketAnalytics.Infrastructure.Services;

public class InstrumentService : IInstrumentService
{
    private readonly IConfiguration _config;
    private readonly ILogger<InstrumentService> _logger;
    private readonly IKiteConnectService _kiteService;
    private readonly string _connectionString;
    private readonly HttpClient _httpClient;

    public InstrumentService(IConfiguration config, ILogger<InstrumentService> logger, 
        IKiteConnectService kiteService, IHttpClientFactory httpClientFactory)
    {
        _config = config;
        _logger = logger;
        _kiteService = kiteService;
        _connectionString = config.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException();
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task SyncInstrumentsAsync()
    {
        var accessToken = await _kiteService.GetActiveAccessTokenAsync();
        if (string.IsNullOrEmpty(accessToken))
        {
            _logger.LogWarning("No active access token found");
            return;
        }

        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("X-Kite-Version", "3");
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"token {_config["Kite:ApiKey"]}:{accessToken}");

        var response = await _httpClient.GetAsync("https://api.kite.trade/instruments");
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Failed to fetch instruments");
            return;
        }

        var csvData = await response.Content.ReadAsStringAsync();
        var instruments = ParseInstrumentsCsv(csvData);

        using var connection = new NpgsqlConnection(_connectionString);
        await connection.ExecuteAsync("TRUNCATE TABLE instrument_master");

        foreach (var batch in instruments.Chunk(1000))
        {
            await connection.ExecuteAsync(
                @"INSERT INTO instrument_master (instrument_token, trading_symbol, exchange, segment, tick_size, lot_size, sector, index_name, index_weight, last_updated)
                  VALUES (@InstrumentToken, @TradingSymbol, @Exchange, @Segment, @TickSize, @LotSize, @Sector, @IndexName, @IndexWeight, @LastUpdated)",
                batch
            );
        }

        _logger.LogInformation("Synced {Count} instruments", instruments.Count);
    }

    public async Task<InstrumentMaster?> GetInstrumentBySymbolAsync(string symbol, string exchange = "NSE")
    {
        using var connection = new NpgsqlConnection(_connectionString);
        return await connection.QueryFirstOrDefaultAsync<InstrumentMaster>(
            "SELECT * FROM instrument_master WHERE trading_symbol = @Symbol AND exchange = @Exchange",
            new { Symbol = symbol, Exchange = exchange }
        );
    }

    public async Task<List<InstrumentMaster>> GetIndexConstituentsAsync(string indexName)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        var instruments = await connection.QueryAsync<InstrumentMaster>(
            "SELECT * FROM instrument_master WHERE index_name = @IndexName AND exchange = 'NSE'",
            new { IndexName = indexName }
        );
        return instruments.ToList();
    }

    private List<InstrumentMaster> ParseInstrumentsCsv(string csvData)
    {
        var instruments = new List<InstrumentMaster>();
        var lines = csvData.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        
        var nifty50Symbols = GetNifty50Symbols();
        
        for (int i = 1; i < lines.Length; i++)
        {
            var fields = lines[i].Split(',');
            if (fields.Length < 6) continue;

            var symbol = fields[2].Trim('"');
            var exchange = fields[3].Trim('"');
            
            if (exchange != "NSE" || fields[1].Trim('"') != "EQ") continue;

            var instrument = new InstrumentMaster
            {
                InstrumentToken = long.Parse(fields[0]),
                TradingSymbol = symbol,
                Exchange = exchange,
                Segment = fields[1].Trim('"'),
                TickSize = decimal.TryParse(fields[6], out var tick) ? tick : null,
                LotSize = int.TryParse(fields[7], out var lot) ? lot : null,
                IndexName = nifty50Symbols.Contains(symbol) ? "NIFTY50" : null,
                LastUpdated = DateTime.UtcNow
            };

            instruments.Add(instrument);
        }

        return instruments;
    }

    private static HashSet<string> GetNifty50Symbols()
    {
        return new HashSet<string>
        {
            "ADANIPORTS", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJFINANCE",
            "BAJAJFINSV", "BHARTIARTL", "BPCL", "BRITANNIA", "CIPLA",
            "COALINDIA", "DIVISLAB", "DRREDDY", "EICHERMOT", "GRASIM",
            "HCLTECH", "HDFC", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO",
            "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK", "INFY",
            "ITC", "JSWSTEEL", "KOTAKBANK", "LT", "M&M",
            "MARUTI", "NESTLEIND", "NTPC", "ONGC", "POWERGRID",
            "RELIANCE", "SBILIFE", "SBIN", "SHREECEM", "SUNPHARMA",
            "TATACONSUM", "TATAMOTORS", "TATASTEEL", "TCS", "TECHM",
            "TITAN", "ULTRACEMCO", "UPL", "WIPRO", "APOLLOHOSP"
        };
    }
}
