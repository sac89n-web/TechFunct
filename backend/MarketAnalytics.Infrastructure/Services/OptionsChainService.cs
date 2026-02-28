using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Dapper;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Npgsql;

namespace MarketAnalytics.Infrastructure.Services;

public class OptionsChainService : IOptionsChainService
{
    private readonly string       _connectionString;
    private readonly string       _apiKey;
    private readonly HttpClient   _http;
    private readonly IGreeksCalculator    _greeks;
    private readonly IKiteConnectService  _kite;
    private readonly ILogger<OptionsChainService> _logger;

    private const double RiskFreeRate = 0.068; // 6.8% — update quarterly

    // Maps TechFunct index code → Kite instrument name in instrument_master
    private static readonly Dictionary<string, string> IndexToKiteName = new()
    {
        { "NIFTY50",      "NIFTY"      },
        { "BANKNIFTY",    "BANKNIFTY"  },
        { "FINNIFTY",     "FINNIFTY"   },
        { "MIDCAPNIFTY",  "MIDCPNIFTY" },
        { "SENSEX",       "SENSEX"     },
    };

    // Maps to Kite exchange for option instruments
    private static readonly Dictionary<string, string> IndexToExchange = new()
    {
        { "NIFTY50",      "NFO" },
        { "BANKNIFTY",    "NFO" },
        { "FINNIFTY",     "NFO" },
        { "MIDCAPNIFTY",  "NFO" },
        { "SENSEX",       "BFO" },
    };

    // Maps to Kite spot quote symbol
    private static readonly Dictionary<string, string> IndexToSpotSymbol = new()
    {
        { "NIFTY50",      "NSE:NIFTY 50"            },
        { "BANKNIFTY",    "NSE:NIFTY BANK"           },
        { "FINNIFTY",     "NSE:NIFTY FIN SERVICE"    },
        { "MIDCAPNIFTY",  "NSE:NIFTY MIDCAP SELECT"  },
        { "SENSEX",       "BSE:SENSEX"               },
    };

    public OptionsChainService(
        IConfiguration config,
        IKiteConnectService kite,
        IGreeksCalculator greeks,
        IHttpClientFactory httpFactory,
        ILogger<OptionsChainService> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")!;
        _apiKey           = config["Kite:ApiKey"]!;
        _kite             = kite;
        _greeks           = greeks;
        _http             = httpFactory.CreateClient();
        _logger           = logger;
    }

    // ─── Public API ───────────────────────────────────────────────────────

    public async Task<List<DateOnly>> GetExpiriesAsync(string indexName)
    {
        if (!IndexToKiteName.TryGetValue(indexName, out string? kiteName))
            throw new ArgumentException($"Unsupported index: {indexName}");

        string exchange = IndexToExchange[indexName];

        using var conn = new NpgsqlConnection(_connectionString);
        var expiries = await conn.QueryAsync<DateTime>(@"
            SELECT DISTINCT expiry
            FROM instrument_master
            WHERE exchange = @Exchange
              AND instrument_type IN ('CE','PE')
              AND name = @Name
              AND expiry >= CURRENT_DATE
            ORDER BY 1 ASC
            LIMIT 12",
            new { Exchange = exchange, Name = kiteName });

        return expiries.Select(DateOnly.FromDateTime).ToList();
    }

    public async Task<decimal> GetUnderlyingLtpAsync(string indexName)
    {
        if (!IndexToSpotSymbol.TryGetValue(indexName, out string? spotSymbol))
            throw new ArgumentException($"Unsupported index: {indexName}");

        string? token = await _kite.GetActiveAccessTokenAsync();
        if (token == null)
            throw new InvalidOperationException(
                "No active Kite session. Please authenticate first.");

        var req = new HttpRequestMessage(HttpMethod.Get,
            $"https://api.kite.trade/quote?i={Uri.EscapeDataString(spotSymbol)}");
        req.Headers.Add("X-Kite-Version", "3");
        req.Headers.Add("Authorization", $"token {_apiKey}:{token}");

        var resp = await _http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Kite quote failed for {spotSymbol}: HTTP {resp.StatusCode}");

        var json   = await resp.Content.ReadAsStringAsync();
        var parsed = JsonConvert.DeserializeObject<KiteQuoteEnvelope>(json);
        if (parsed?.Data == null || !parsed.Data.TryGetValue(spotSymbol, out var q))
            throw new InvalidOperationException(
                $"Spot LTP not found in Kite response for {spotSymbol}");

        if (q.LastPrice <= 0)
            throw new InvalidOperationException(
                $"Spot LTP is 0 for {spotSymbol}. Market may be closed.");

        return q.LastPrice;
    }

    public async Task<OptionChainResultDto> GetOptionChainAsync(string indexName, DateOnly expiry)
    {
        if (!IndexToKiteName.TryGetValue(indexName, out string? kiteName))
            throw new ArgumentException($"Unsupported index: {indexName}");

        string exchange = IndexToExchange[indexName];
        string? token   = await _kite.GetActiveAccessTokenAsync();
        if (token == null)
            throw new InvalidOperationException(
                "No active Kite session. Please authenticate first.");

        // 1. Spot LTP
        decimal spotLTP = await GetUnderlyingLtpAsync(indexName);

        // 2. Load instruments from DB for this expiry
        using var conn = new NpgsqlConnection(_connectionString);
        var instruments = (await conn.QueryAsync<OptionInstrumentRow>(@"
            SELECT instrument_token, trading_symbol, strike, instrument_type, lot_size
            FROM instrument_master
            WHERE exchange = @Exchange
              AND instrument_type IN ('CE','PE')
              AND name = @Name
              AND expiry = @Expiry
            ORDER BY strike ASC, instrument_type ASC",
            new { Exchange = exchange, Name = kiteName,
                  Expiry = expiry.ToDateTime(TimeOnly.MinValue) }))
            .ToList();

        if (instruments.Count == 0)
            throw new InvalidOperationException(
                $"No instruments for {indexName} expiry {expiry}. " +
                "Run Sync Instruments first.");

        // 3. Batch quote — max 500 per call
        var allQuotes = new Dictionary<string, KiteOptionQuote>(
            StringComparer.OrdinalIgnoreCase);

        var batches = instruments
            .Select(i => $"{exchange}:{i.TradingSymbol}")
            .Chunk(500);

        foreach (var batch in batches)
        {
            var qs   = string.Join("&i=", batch.Select(Uri.EscapeDataString));
            var breq = new HttpRequestMessage(HttpMethod.Get,
                $"https://api.kite.trade/quote?i={qs}");
            breq.Headers.Add("X-Kite-Version", "3");
            breq.Headers.Add("Authorization", $"token {_apiKey}:{token}");

            var bresp = await _http.SendAsync(breq);
            if (!bresp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Kite batch quote HTTP {Status}", bresp.StatusCode);
                continue;
            }

            var bJson   = await bresp.Content.ReadAsStringAsync();
            var bParsed = JsonConvert.DeserializeObject<KiteOptionQuoteEnvelope>(bJson);
            if (bParsed?.Data == null) continue;

            foreach (var kv in bParsed.Data)
                allQuotes[kv.Key] = kv.Value;
        }

        if (allQuotes.Count == 0)
            throw new InvalidOperationException(
                "All Kite quote batches failed. Check token and market hours.");

        // 4. Compute DTE and time fraction
        int    DTE = expiry.DayNumber - DateOnly.FromDateTime(DateTime.Today).DayNumber;
        double T   = Math.Max(DTE, 0.5) / 365.0;

        // 5. Build chain entries with Greeks
        var entries = new List<OptionChainEntryDto>();

        foreach (var inst in instruments)
        {
            string key = $"{exchange}:{inst.TradingSymbol}";
            if (!allQuotes.TryGetValue(key, out KiteOptionQuote? q)) continue;

            bool   isCall      = inst.InstrumentType == "CE";
            decimal ltp        = q.LastPrice;
            decimal bid        = q.Depth?.Buy?.Length > 0 ? q.Depth.Buy[0].Price : 0m;
            decimal ask        = q.Depth?.Sell?.Length > 0 ? q.Depth.Sell[0].Price : 0m;
            long   oi          = q.OI;
            long   oiChg       = q.OIDayHigh - q.OIDayLow;
            long   vol         = q.VolumeTraded;
            int    lotSize     = inst.LotSize;

            double? iv = null, delta = null, gamma = null, theta = null, vega = null;
            bool    ivUnavailable = false;

            if (ltp > 0 && T > 0)
            {
                double S = (double)spotLTP;
                double K = (double)inst.Strike;

                iv = _greeks.ImpliedVolatility(
                    (double)ltp, S, K, T, RiskFreeRate, isCall);

                if (iv.HasValue && iv.Value >= 0.01 && iv.Value <= 5.0)
                {
                    delta = _greeks.Delta(S, K, T, RiskFreeRate, iv.Value, isCall);
                    gamma = _greeks.Gamma(S, K, T, RiskFreeRate, iv.Value);
                    theta = _greeks.Theta(S, K, T, RiskFreeRate, iv.Value, isCall);
                    vega  = _greeks.Vega(S, K, T, RiskFreeRate, iv.Value);
                }
                else
                {
                    iv            = null;
                    ivUnavailable = true;
                }
            }
            else
            {
                ivUnavailable = ltp == 0;
            }

            entries.Add(new OptionChainEntryDto
            {
                InstrumentToken = inst.InstrumentToken,
                TradingSymbol   = inst.TradingSymbol,
                Strike          = inst.Strike,
                OptionType      = inst.InstrumentType,
                Expiry          = expiry,
                LTP             = ltp,
                Bid             = bid,
                Ask             = ask,
                OI              = oi,
                OIChange        = oiChg,
                Volume          = vol,
                IV              = iv,
                Delta           = delta,
                Gamma           = gamma,
                Theta           = theta,
                Vega            = vega,
                LotSize         = lotSize,
                IvUnavailable   = ivUnavailable
            });
        }

        // 6. Calculate market metrics
        decimal pcr     = CalcPCR(entries);
        decimal maxPain = CalcMaxPain(entries);
        double? atmIV   = CalcAtmIV(entries, spotLTP);
        double? ivPerc  = await GetIVPercentileAsync(conn, indexName, atmIV);
        double? ivSkew  = CalcIVSkew(entries, spotLTP);

        // 7. Write IV history
        if (atmIV.HasValue)
            await UpsertIVHistoryAsync(conn, indexName, atmIV.Value, ivPerc);

        // 8. Write chain to cache table
        await UpsertChainCacheAsync(conn, indexName, expiry, entries);

        bool dataComplete = entries.Count > 0
            && allQuotes.Count >= instruments.Count * 0.9;

        return new OptionChainResultDto
        {
            IndexName     = indexName,
            UnderlyingLTP = spotLTP,
            Expiry        = expiry,
            DTE           = DTE,
            Chain         = entries,
            PCR           = pcr,
            MaxPain       = maxPain,
            AtmIV         = atmIV,
            IVPercentile  = ivPerc,
            IVSkew        = ivSkew,
            LastUpdated   = DateTime.UtcNow,
            DataComplete  = dataComplete,
            Warning       = dataComplete ? null
                : "Partial chain — some strikes missing from Kite response"
        };
    }

    // ─── Market Metric Helpers ────────────────────────────────────────────

    private static decimal CalcPCR(List<OptionChainEntryDto> chain)
    {
        long putOI  = chain.Where(c => c.OptionType == "PE").Sum(c => c.OI);
        long callOI = chain.Where(c => c.OptionType == "CE").Sum(c => c.OI);
        return callOI == 0 ? 0m : Math.Round((decimal)putOI / callOI, 3);
    }

    private static decimal CalcMaxPain(List<OptionChainEntryDto> chain)
    {
        var strikes = chain.Select(c => c.Strike).Distinct().OrderBy(s => s).ToList();
        if (strikes.Count < 2) return 0m;

        var calls = chain.Where(c => c.OptionType == "CE")
            .ToDictionary(c => c.Strike);
        var puts  = chain.Where(c => c.OptionType == "PE")
            .ToDictionary(c => c.Strike);

        decimal minPain = decimal.MaxValue, maxPainStrike = 0;

        foreach (var ep in strikes)
        {
            decimal totalLoss = 0;
            foreach (var s in strikes)
            {
                if (calls.TryGetValue(s, out var c))
                    totalLoss += Math.Max(0, ep - s) * c.OI;
                if (puts.TryGetValue(s, out var p))
                    totalLoss += Math.Max(0, s - ep) * p.OI;
            }
            if (totalLoss < minPain) { minPain = totalLoss; maxPainStrike = ep; }
        }
        return maxPainStrike;
    }

    private static double? CalcAtmIV(List<OptionChainEntryDto> chain, decimal spot)
    {
        decimal atm = chain.Select(c => c.Strike)
            .OrderBy(s => Math.Abs((double)(s - spot)))
            .FirstOrDefault();
        var atmEntries = chain.Where(c => c.Strike == atm && c.IV.HasValue).ToList();
        return atmEntries.Any() ? atmEntries.Average(c => c.IV!.Value) : null;
    }

    private static double? CalcIVSkew(List<OptionChainEntryDto> chain, decimal spot)
    {
        double lo = (double)(spot * 0.95m);
        double hi = (double)(spot * 1.05m);
        var otmP = chain.Where(c => c.OptionType == "PE"
            && (double)c.Strike <= (double)spot
            && (double)c.Strike >= lo && c.IV.HasValue);
        var otmC = chain.Where(c => c.OptionType == "CE"
            && (double)c.Strike >= (double)spot
            && (double)c.Strike <= hi && c.IV.HasValue);
        if (!otmP.Any() || !otmC.Any()) return null;
        return otmP.Average(c => c.IV!.Value) - otmC.Average(c => c.IV!.Value);
    }

    private async Task<double?> GetIVPercentileAsync(
        NpgsqlConnection conn, string indexName, double? currentIV)
    {
        if (!currentIV.HasValue) return null;
        var hist = (await conn.QueryAsync<double>(@"
            SELECT atm_iv FROM option_iv_history
            WHERE index_name = @IndexName
              AND trade_date >= CURRENT_DATE - INTERVAL '1 year'
            ORDER BY trade_date ASC",
            new { IndexName = indexName })).ToList();
        if (hist.Count < 10) return null;
        int below = hist.Count(v => v < currentIV.Value);
        return Math.Round((double)below / hist.Count * 100, 1);
    }

    private async Task UpsertIVHistoryAsync(
        NpgsqlConnection conn, string indexName, double atmIV, double? ivPercentile)
    {
        await conn.ExecuteAsync(@"
            INSERT INTO option_iv_history (index_name, trade_date, atm_iv, iv_percentile)
            VALUES (@IndexName, CURRENT_DATE, @AtmIV, @IVPercentile)
            ON CONFLICT (index_name, trade_date)
            DO UPDATE SET atm_iv = EXCLUDED.atm_iv,
                          iv_percentile = EXCLUDED.iv_percentile",
            new { IndexName = indexName, AtmIV = atmIV, IVPercentile = ivPercentile });
    }

    private async Task UpsertChainCacheAsync(
        NpgsqlConnection conn, string indexName, DateOnly expiry,
        List<OptionChainEntryDto> entries)
    {
        foreach (var e in entries)
        {
            await conn.ExecuteAsync(@"
                INSERT INTO option_chain_cache
                    (index_name, expiry_date, strike, instrument_token, trading_symbol,
                     option_type, ltp, bid, ask, oi, oi_change, volume,
                     iv, delta_val, gamma_val, theta_val, vega_val, lot_size, last_updated)
                VALUES
                    (@IndexName, @Expiry, @Strike, @InstrumentToken, @TradingSymbol,
                     @OptionType, @LTP, @Bid, @Ask, @OI, @OIChange, @Volume,
                     @IV, @Delta, @Gamma, @Theta, @Vega, @LotSize, NOW())
                ON CONFLICT (index_name, expiry_date, strike, option_type)
                DO UPDATE SET
                    ltp = EXCLUDED.ltp, bid = EXCLUDED.bid, ask = EXCLUDED.ask,
                    oi = EXCLUDED.oi, oi_change = EXCLUDED.oi_change,
                    volume = EXCLUDED.volume,
                    iv = EXCLUDED.iv, delta_val = EXCLUDED.delta_val,
                    gamma_val = EXCLUDED.gamma_val, theta_val = EXCLUDED.theta_val,
                    vega_val = EXCLUDED.vega_val, last_updated = NOW()",
                new
                {
                    IndexName        = indexName,
                    Expiry           = expiry.ToDateTime(TimeOnly.MinValue),
                    e.Strike,
                    e.InstrumentToken,
                    e.TradingSymbol,
                    OptionType       = e.OptionType,
                    LTP              = e.LTP,
                    e.Bid, e.Ask, e.OI,
                    OIChange         = e.OIChange,
                    e.Volume,
                    IV               = e.IV,
                    Delta            = e.Delta,
                    Gamma            = e.Gamma,
                    Theta            = e.Theta,
                    Vega             = e.Vega,
                    e.LotSize
                });
        }
    }

    // ─── Private DTOs for Kite API ────────────────────────────────────────

    private class OptionInstrumentRow
    {
        public long    InstrumentToken { get; set; }
        public string  TradingSymbol   { get; set; } = string.Empty;
        public decimal Strike          { get; set; }
        public string  InstrumentType  { get; set; } = string.Empty;
        public int     LotSize         { get; set; }
    }

    private class KiteQuoteEnvelope
    {
        [JsonProperty("data")]
        public Dictionary<string, KiteOptionQuote>? Data { get; set; }
    }

    private class KiteOptionQuoteEnvelope
    {
        [JsonProperty("data")]
        public Dictionary<string, KiteOptionQuote>? Data { get; set; }
    }

    private class KiteOptionQuote
    {
        [JsonProperty("last_price")]
        public decimal LastPrice { get; set; }

        [JsonProperty("volume_traded")]
        public long VolumeTraded { get; set; }

        [JsonProperty("oi")]
        public long OI { get; set; }

        [JsonProperty("oi_day_high")]
        public long OIDayHigh { get; set; }

        [JsonProperty("oi_day_low")]
        public long OIDayLow { get; set; }

        [JsonProperty("depth")]
        public KiteDepth? Depth { get; set; }
    }

    private class KiteDepth
    {
        [JsonProperty("buy")]
        public KiteDepthEntry[]? Buy { get; set; }

        [JsonProperty("sell")]
        public KiteDepthEntry[]? Sell { get; set; }
    }

    private class KiteDepthEntry
    {
        [JsonProperty("price")]
        public decimal Price { get; set; }
    }
}
