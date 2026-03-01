using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Dapper;
using MarketAnalytics.Core.Entities;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
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


    public async System.Threading.Tasks.Task<System.Collections.Generic.List<string>> GetIndexSymbolsAsync(string indexName)
    {
        var sectorSymbols = GetSectorIndexSymbols(indexName);
        if (sectorSymbols != null)
            return sectorSymbols.ToList();

        using var connection = new NpgsqlConnection(_connectionString);
        var symbols = await connection.QueryAsync<string>(
            "SELECT trading_symbol FROM instrument_master WHERE index_name = @IndexName AND exchange = 'NSE'",
            new { IndexName = indexName }
        );
        return symbols.ToList();
    }

    private static System.Collections.Generic.HashSet<string>? GetSectorIndexSymbols(string indexName) => indexName switch
    {
        "NIFTY BANK" => new System.Collections.Generic.HashSet<string> {
            "HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK", "SBIN", "INDUSINDBK",
            "BANDHANBNK", "FEDERALBNK", "IDFCFIRSTB", "PNB", "RBLBANK", "AUBANK" },
        "NIFTY IT" => new System.Collections.Generic.HashSet<string> {
            "TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "LTIM",
            "MPHASIS", "COFORGE", "PERSISTENT", "OFSS" },
        "NIFTY PHARMA" => new System.Collections.Generic.HashSet<string> {
            "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "APOLLOHOSP",
            "TORNTPHARM", "ALKEM", "LUPIN", "AUROPHARMA", "BIOCON" },
        "NIFTY AUTO" => new System.Collections.Generic.HashSet<string> {
            "MARUTI", "TATAMOTORS", "BAJAJ-AUTO", "HEROMOTOCO", "EICHERMOT",
            "M&M", "TVSMOTOR", "BOSCHLTD", "BALKRISIND", "APOLLOTYRE" },
        "NIFTY FMCG" => new System.Collections.Generic.HashSet<string> {
            "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR",
            "GODREJCP", "MARICO", "COLPAL", "EMAMILTD", "TATACONSUM" },
        _ => null
    };

    public async Task<List<InstrumentMaster>> GetInstrumentsBySymbolsAsync(IEnumerable<string> symbols)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        var result = await connection.QueryAsync<InstrumentMaster>(
            "SELECT * FROM instrument_master WHERE trading_symbol = ANY(@Symbols) AND exchange = 'NSE'",
            new { Symbols = symbols.ToArray() });
        return result.ToList();
    }

    public async Task SeedMarketSnapshotAsync(IEnumerable<InstrumentMaster> instruments)
    {
        var accessToken = await _kiteService.GetActiveAccessTokenAsync();
        if (string.IsNullOrEmpty(accessToken))
        {
            _logger.LogWarning("No active access token for quote seeding");
            return;
        }

        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("X-Kite-Version", "3");
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"token {_config["Kite:ApiKey"]}:{accessToken}");

        var instrumentList = instruments.ToList();
        const int batchSize = 500;

        using var connection = new NpgsqlConnection(_connectionString);

        for (int offset = 0; offset < instrumentList.Count; offset += batchSize)
        {
            var batch = instrumentList.Skip(offset).Take(batchSize).ToList();
            var queryString = string.Join("&", batch.Select(i => $"i=NSE:{Uri.EscapeDataString(i.TradingSymbol)}"));

            try
            {
                var response = await _httpClient.GetAsync($"https://api.kite.trade/quote?{queryString}");
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Kite quote API returned {Status}", response.StatusCode);
                    continue;
                }

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonConvert.DeserializeObject<KiteQuoteResponse>(json);
                if (result?.Data == null) continue;

                foreach (var inst in batch)
                {
                    var key = $"NSE:{inst.TradingSymbol}";
                    if (!result.Data.TryGetValue(key, out var quote)) continue;

                    var prevClose = quote.Ohlc?.Close ?? 0m;
                    var changePercent = prevClose > 0
                        ? ((quote.LastPrice - prevClose) / prevClose) * 100m
                        : 0m;

                    await connection.ExecuteAsync(
                        @"INSERT INTO market_snapshot
                            (symbol, instrument_token, ltp, change_percent, volume, high, low, open, index_name, last_updated)
                          VALUES
                            (@Symbol, @InstrumentToken, @Ltp, @ChangePercent, @Volume, @High, @Low, @Open, @IndexName, @LastUpdated)
                          ON CONFLICT (symbol) DO UPDATE SET
                            ltp = @Ltp, change_percent = @ChangePercent, volume = @Volume,
                            high = @High, low = @Low, open = @Open, last_updated = @LastUpdated",
                        new
                        {
                            Symbol = inst.TradingSymbol,
                            InstrumentToken = inst.InstrumentToken,
                            Ltp = quote.LastPrice,
                            ChangePercent = changePercent,
                            Volume = quote.VolumeTraded,
                            High = quote.Ohlc?.High ?? 0m,
                            Low = quote.Ohlc?.Low ?? 0m,
                            Open = quote.Ohlc?.Open ?? 0m,
                            IndexName = inst.IndexName,
                            LastUpdated = DateTime.UtcNow
                        });
                }

                _logger.LogInformation("Seeded market_snapshot for {Count} symbols", batch.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to seed market snapshot for batch at offset {Offset}", offset);
            }
        }
    }

    // ─── Option Instruments Sync ────────────────────────────────────────────────

    /// <summary>
    /// Downloads Kite instruments CSV and upserts NFO/BFO option contracts
    /// (CE/PE for NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX) expiring within
    /// the next 3 months into instrument_master.  Must be called AFTER
    /// SyncInstrumentsAsync (which TRUNCATEs the table) so that options survive.
    /// </summary>
    public async Task SyncOptionInstrumentsAsync()
    {
        var accessToken = await _kiteService.GetActiveAccessTokenAsync();
        if (string.IsNullOrEmpty(accessToken))
        {
            _logger.LogWarning("SyncOptionInstruments: no active Kite token");
            return;
        }

        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("X-Kite-Version", "3");
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"token {_config["Kite:ApiKey"]}:{accessToken}");

        var response = await _httpClient.GetAsync("https://api.kite.trade/instruments");
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("SyncOptionInstruments: Kite instruments endpoint returned {Status}", response.StatusCode);
            return;
        }

        var csvData = await response.Content.ReadAsStringAsync();
        var options = ParseOptionInstrumentsCsv(csvData);

        if (options.Count == 0)
        {
            _logger.LogWarning("SyncOptionInstruments: no option instruments parsed");
            return;
        }

        using var connection = new NpgsqlConnection(_connectionString);

        foreach (var batch in options.Chunk(500))
        {
            await connection.ExecuteAsync(
                @"INSERT INTO instrument_master
                    (instrument_token, trading_symbol, exchange, segment, tick_size, lot_size,
                     name, expiry, strike, instrument_type, last_updated)
                  VALUES
                    (@InstrumentToken, @TradingSymbol, @Exchange, @Segment, @TickSize, @LotSize,
                     @Name, @Expiry, @Strike, @InstrumentType, @LastUpdated)
                  ON CONFLICT (trading_symbol, exchange) DO UPDATE SET
                    instrument_token = EXCLUDED.instrument_token,
                    segment          = EXCLUDED.segment,
                    tick_size        = EXCLUDED.tick_size,
                    lot_size         = EXCLUDED.lot_size,
                    name             = EXCLUDED.name,
                    expiry           = EXCLUDED.expiry,
                    strike           = EXCLUDED.strike,
                    instrument_type  = EXCLUDED.instrument_type,
                    last_updated     = EXCLUDED.last_updated",
                batch
            );
        }

        _logger.LogInformation("SyncOptionInstruments: upserted {Count} NFO/BFO option contracts", options.Count);
    }

    private static readonly HashSet<string> _optionNames =
        new(StringComparer.OrdinalIgnoreCase)
        { "NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX" };

    private List<InstrumentMaster> ParseOptionInstrumentsCsv(string csvData)
    {
        var options = new List<InstrumentMaster>();
        var cutoff  = DateTime.Today.AddMonths(3);
        var lines   = csvData.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        // CSV columns (0-indexed):
        // 0: instrument_token, 1: exchange_token, 2: tradingsymbol, 3: name,
        // 4: last_price, 5: expiry, 6: strike, 7: tick_size, 8: lot_size,
        // 9: instrument_type, 10: segment, 11: exchange

        for (int i = 1; i < lines.Length; i++)
        {
            var fields = lines[i].Split(',');
            if (fields.Length < 12) continue;

            var exchange       = fields[11].Trim('"', ' ');
            var instrumentType = fields[9].Trim('"', ' ');
            var name           = fields[3].Trim('"', ' ');

            // Only NFO or BFO, only CE/PE, only known index names
            if (exchange != "NFO" && exchange != "BFO") continue;
            if (instrumentType != "CE" && instrumentType != "PE") continue;
            if (!_optionNames.Contains(name)) continue;

            if (!long.TryParse(fields[0].Trim(), out var token)) continue;

            // Parse expiry — Kite uses yyyy-MM-dd
            if (!DateTime.TryParse(fields[5].Trim('"', ' '), out var expiry)) continue;
            if (expiry < DateTime.Today || expiry > cutoff) continue;

            if (!decimal.TryParse(fields[6].Trim(), out var strike)) continue;

            var instrument = new InstrumentMaster
            {
                InstrumentToken = token,
                TradingSymbol   = fields[2].Trim('"', ' '),
                Exchange        = exchange,
                Segment         = fields[10].Trim('"', ' '),
                TickSize        = decimal.TryParse(fields[7].Trim(), out var tick) ? tick : null,
                LotSize         = int.TryParse(fields[8].Trim(), out var lot) ? lot : null,
                Name            = name,
                Expiry          = expiry,
                Strike          = strike,
                InstrumentType  = instrumentType,
                LastUpdated     = DateTime.UtcNow
            };

            options.Add(instrument);
        }

        return options;
    }

    // Private DTOs for Kite quote REST response
    private class KiteQuoteResponse
    {
        [JsonProperty("status")]
        public string Status { get; set; } = string.Empty;

        [JsonProperty("data")]
        public Dictionary<string, KiteQuote>? Data { get; set; }
    }

    private class KiteQuote
    {
        [JsonProperty("last_price")]
        public decimal LastPrice { get; set; }

        [JsonProperty("volume_traded")]
        public long VolumeTraded { get; set; }

        [JsonProperty("ohlc")]
        public KiteOhlc? Ohlc { get; set; }
    }

    private class KiteOhlc
    {
        [JsonProperty("open")]
        public decimal Open { get; set; }

        [JsonProperty("high")]
        public decimal High { get; set; }

        [JsonProperty("low")]
        public decimal Low { get; set; }

        [JsonProperty("close")]
        public decimal Close { get; set; }
    }

    private List<InstrumentMaster> ParseInstrumentsCsv(string csvData)
    {
        var instruments = new List<InstrumentMaster>();
        var lines = csvData.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        
        var nifty50Symbols = GetNifty50Symbols();
        
        // CSV columns: instrument_token(0), exchange_token(1), tradingsymbol(2), name(3),
        //              last_price(4), expiry(5), strike(6), tick_size(7), lot_size(8),
        //              instrument_type(9), segment(10), exchange(11)
        for (int i = 1; i < lines.Length; i++)
        {
            var fields = lines[i].Split(',');
            if (fields.Length < 12) continue;

            var symbol = fields[2].Trim('"', ' ');
            var exchange = fields[11].Trim('"', ' ');
            var instrumentType = fields[9].Trim('"', ' ');

            if (exchange != "NSE" || instrumentType != "EQ") continue;

            if (!long.TryParse(fields[0].Trim(), out var token)) continue;

            var instrument = new InstrumentMaster
            {
                InstrumentToken = token,
                TradingSymbol = symbol,
                Exchange = exchange,
                Segment = fields[10].Trim('"', ' '),
                TickSize = decimal.TryParse(fields[7].Trim(), out var tick) ? tick : null,
                LotSize = int.TryParse(fields[8].Trim(), out var lot) ? lot : null,
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
