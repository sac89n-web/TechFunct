using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Dapper;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Entities;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Npgsql;

namespace MarketAnalytics.Infrastructure.Services;

public class MarketAnalyticsService : IMarketAnalyticsService
{
    private readonly IConfiguration _config;
    private readonly ILogger<MarketAnalyticsService> _logger;
    private readonly IMarketDataCache _cache;
    private readonly IInstrumentService _instrumentService;
    private readonly IKiteConnectService _kiteService;
    private readonly string _connectionString;
    private readonly HttpClient _httpClient;

    // Major indices to show in the top ticker bar
    private static readonly (string Name, string KiteSymbol)[] TrackedIndices = {
        ("NIFTY 50",        "NSE:NIFTY 50"),
        ("SENSEX",          "BSE:SENSEX"),
        ("NIFTY BANK",      "NSE:NIFTY BANK"),
        ("NIFTY IT",        "NSE:NIFTY IT"),
        ("NIFTY PHARMA",    "NSE:NIFTY PHARMA"),
        ("NIFTY AUTO",      "NSE:NIFTY AUTO"),
        ("NIFTY FMCG",      "NSE:NIFTY FMCG"),
        ("NIFTY MIDCAP 100","NSE:NIFTY MIDCAP 100"),
        ("INDIA VIX",       "NSE:INDIA VIX"),
    };

    public MarketAnalyticsService(IConfiguration config, ILogger<MarketAnalyticsService> logger,
        IMarketDataCache cache, IInstrumentService instrumentService,
        IKiteConnectService kiteService, IHttpClientFactory httpClientFactory)
    {
        _config = config;
        _logger = logger;
        _cache = cache;
        _instrumentService = instrumentService;
        _kiteService = kiteService;
        _connectionString = config.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException();
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task<List<HeatmapItemDto>> GetHeatmapAsync(string indexName)
    {
        var symbols = await _instrumentService.GetIndexSymbolsAsync(indexName);
        if (symbols.Count == 0) return new List<HeatmapItemDto>();

        using var connection = new NpgsqlConnection(_connectionString);
        var snapshots = await connection.QueryAsync<MarketSnapshot>(
            "SELECT * FROM market_snapshot WHERE symbol = ANY(@Symbols)",
            new { Symbols = symbols.ToArray() }
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
        var symbols = await _instrumentService.GetIndexSymbolsAsync(indexName);
        if (symbols.Count == 0) return new List<MomentumItemDto>();

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
            LEFT JOIN (
                SELECT DISTINCT ON (symbol) * FROM technical_indicators ORDER BY symbol, calculation_date DESC
            ) ti ON ms.symbol = ti.symbol
            LEFT JOIN (
                SELECT DISTINCT ON (symbol) * FROM momentum_scores ORDER BY symbol, calculation_date DESC
            ) mom ON ms.symbol = mom.symbol
            WHERE ms.symbol = ANY(@Symbols)
            ORDER BY COALESCE(mom.momentum_score, 0) DESC";

        var results = await connection.QueryAsync<MomentumItemDto>(query, new { Symbols = symbols.ToArray() });
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
            ChangePercent = snapshot.ChangePercent,
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

    public async Task<List<StockAnalysisDto>> GetIndexAnalysisAsync(string indexName)
    {
        var symbols = await _instrumentService.GetIndexSymbolsAsync(indexName);
        if (symbols.Count == 0) return new List<StockAnalysisDto>();

        using var connection = new NpgsqlConnection(_connectionString);
        var rows = await connection.QueryAsync<IndexAnalysisRow>(@"
            SELECT
                ms.symbol,
                ms.ltp,
                ms.change_percent,
                ti.sma20, ti.sma50, ti.sma200,
                ti.rsi14,
                ti.bb_upper, ti.bb_middle, ti.bb_lower,
                ti.is_golden_cross, ti.is_death_cross,
                ti.volume_ratio,
                COALESCE(mom.momentum_score, 0) AS momentum_score,
                COALESCE(mom.signal, 'UNKNOWN') AS trade_signal
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
            WHERE ms.symbol = ANY(@Symbols)
            ORDER BY COALESCE(mom.momentum_score, 0) DESC",
            new { Symbols = symbols.ToArray() });

        return rows.Select(r =>
        {
            var (t1, t2, sl) = CalculateTargets(r.Ltp, r.Sma20);
            return new StockAnalysisDto
            {
                Symbol = r.Symbol,
                CurrentPrice = r.Ltp,
                ChangePercent = r.ChangePercent,
                SMA20 = r.Sma20,
                SMA50 = r.Sma50,
                SMA200 = r.Sma200,
                RSI = r.Rsi14,
                GoldenCross = r.IsGoldenCross,
                DeathCross = r.IsDeathCross,
                BBUpper = r.BbUpper,
                BBMiddle = r.BbMiddle,
                BBLower = r.BbLower,
                BBPosition = GetBBPosition(r.Ltp, r.BbUpper, r.BbMiddle, r.BbLower),
                CompositeScore = r.MomentumScore,
                TradeSignal = r.TradeSignal,
                Target1 = t1,
                Target2 = t2,
                StopLoss = sl,
                RiskReward = sl.HasValue && t1.HasValue && r.Ltp > sl.Value
                    ? (t1.Value - r.Ltp) / (r.Ltp - sl.Value) : null
            };
        }).ToList();
    }

    private class IndexAnalysisRow
    {
        public string Symbol { get; set; } = string.Empty;
        public decimal Ltp { get; set; }
        public decimal ChangePercent { get; set; }
        public decimal? Sma20 { get; set; }
        public decimal? Sma50 { get; set; }
        public decimal? Sma200 { get; set; }
        public decimal? Rsi14 { get; set; }
        public decimal? BbUpper { get; set; }
        public decimal? BbMiddle { get; set; }
        public decimal? BbLower { get; set; }
        public bool? IsGoldenCross { get; set; }
        public bool? IsDeathCross { get; set; }
        public decimal? VolumeRatio { get; set; }
        public decimal MomentumScore { get; set; }
        public string TradeSignal { get; set; } = string.Empty;
    }

    public async Task<MarketBreadthDto?> GetMarketBreadthAsync(string indexName)
    {
        var symbols = await _instrumentService.GetIndexSymbolsAsync(indexName);
        if (symbols.Count == 0)
            return new MarketBreadthDto { IndexName = indexName, CalculationDate = DateTime.UtcNow };

        using var connection = new NpgsqlConnection(_connectionString);

        var snapshots = await connection.QueryAsync<MarketSnapshot>(
            "SELECT * FROM market_snapshot WHERE symbol = ANY(@Symbols)",
            new { Symbols = symbols.ToArray() }
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
        => GetBBPosition(ltp, indicators.BBUpper, indicators.BBMiddle, indicators.BBLower);

    private static string? GetBBPosition(decimal ltp, decimal? bbUpper, decimal? bbMiddle, decimal? bbLower)
    {
        if (!bbUpper.HasValue || !bbMiddle.HasValue || !bbLower.HasValue) return null;
        if (ltp > bbUpper) return "Above Upper Band";
        if (ltp < bbLower) return "Below Lower Band";
        if (ltp > bbMiddle) return "Above Middle";
        return "Below Middle";
    }

    private static (decimal? Target1, decimal? Target2, decimal? StopLoss) CalculateTargets(decimal ltp, TechnicalIndicators indicators)
        => CalculateTargets(ltp, indicators.SMA20);

    private static (decimal? Target1, decimal? Target2, decimal? StopLoss) CalculateTargets(decimal ltp, decimal? sma20)
    {
        decimal? target1 = ltp * 1.05m;
        decimal? target2 = ltp * 1.10m;
        decimal? stopLoss = sma20 ?? ltp * 0.95m;
        return (target1, target2, stopLoss);
    }

    public async Task<List<IndexQuoteDto>> GetIndexQuotesAsync()
    {
        var accessToken = await _kiteService.GetActiveAccessTokenAsync();
        if (string.IsNullOrEmpty(accessToken))
            return BuildEmptyIndexQuotes();

        try
        {
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("X-Kite-Version", "3");
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"token {_config["Kite:ApiKey"]}:{accessToken}");

            var queryString = string.Join("&", TrackedIndices.Select(idx => $"i={Uri.EscapeDataString(idx.KiteSymbol)}"));
            var response = await _httpClient.GetAsync($"https://api.kite.trade/quote?{queryString}");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Kite index quote API returned {Status}", response.StatusCode);
                return BuildEmptyIndexQuotes();
            }

            var json = await response.Content.ReadAsStringAsync();
            var result = JsonConvert.DeserializeObject<KiteIndexQuoteResponse>(json);
            if (result?.Data == null) return BuildEmptyIndexQuotes();

            var quotes = new List<IndexQuoteDto>();
            foreach (var (name, kiteSymbol) in TrackedIndices)
            {
                if (!result.Data.TryGetValue(kiteSymbol, out var q))
                {
                    quotes.Add(new IndexQuoteDto { Name = name, KiteSymbol = kiteSymbol });
                    continue;
                }

                var prevClose  = q.Ohlc?.Close ?? 0m;
                var change     = q.LastPrice - prevClose;
                var changePct  = prevClose > 0 ? (change / prevClose) * 100m : 0m;

                quotes.Add(new IndexQuoteDto
                {
                    Name          = name,
                    KiteSymbol    = kiteSymbol,
                    LastPrice     = q.LastPrice,
                    Change        = change,
                    ChangePercent = Math.Round(changePct, 2),
                    Open          = q.Ohlc?.Open  ?? 0m,
                    High          = q.Ohlc?.High  ?? 0m,
                    Low           = q.Ohlc?.Low   ?? 0m,
                    PrevClose     = prevClose
                });
            }
            return quotes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch index quotes from Kite");
            return BuildEmptyIndexQuotes();
        }
    }

    private static List<IndexQuoteDto> BuildEmptyIndexQuotes()
        => TrackedIndices.Select(idx => new IndexQuoteDto { Name = idx.Name, KiteSymbol = idx.KiteSymbol }).ToList();

    // Private DTOs for Kite index quote response
    private class KiteIndexQuoteResponse
    {
        [JsonProperty("data")]
        public Dictionary<string, KiteIndexQuote>? Data { get; set; }
    }

    private class KiteIndexQuote
    {
        [JsonProperty("last_price")]
        public decimal LastPrice { get; set; }

        [JsonProperty("ohlc")]
        public KiteIndexOhlc? Ohlc { get; set; }
    }

    private class KiteIndexOhlc
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
}
