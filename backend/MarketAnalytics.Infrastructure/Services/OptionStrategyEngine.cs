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
using Newtonsoft.Json;
using Npgsql;

namespace MarketAnalytics.Infrastructure.Services;

public class OptionStrategyEngine : IOptionStrategyEngine
{
    private readonly IOptionsChainService _chain;
    private readonly IIndicatorEngine     _indicators;
    private readonly string               _conn;
    private readonly ILogger<OptionStrategyEngine> _logger;

    // Scoring weights
    private const double W_Trend     = 0.25;
    private const double W_IV        = 0.20;
    private const double W_OI        = 0.20;
    private const double W_Liquidity = 0.15;
    private const double W_Risk      = 0.12;
    private const double W_Greeks    = 0.08;

    private static readonly Dictionary<string, string> IndexToUnderlyingSymbol = new()
    {
        { "NIFTY50",      "NIFTY 50"             },
        { "BANKNIFTY",    "NIFTY BANK"            },
        { "FINNIFTY",     "NIFTY FIN SERVICE"     },
        { "MIDCAPNIFTY",  "NIFTY MIDCAP SELECT"   },
        { "SENSEX",       "SENSEX"                },
    };

    private static readonly Dictionary<string, decimal> SpanPct = new()
    {
        { "NIFTY50",      0.105m },
        { "BANKNIFTY",    0.145m },
        { "FINNIFTY",     0.120m },
        { "MIDCAPNIFTY",  0.120m },
        { "SENSEX",       0.105m },
    };

    public OptionStrategyEngine(
        IOptionsChainService chainService,
        IIndicatorEngine indicators,
        IConfiguration config,
        ILogger<OptionStrategyEngine> logger)
    {
        _chain      = chainService;
        _indicators = indicators;
        _conn       = config.GetConnectionString("DefaultConnection")!;
        _logger     = logger;
    }

    // ─── Entry Point ──────────────────────────────────────────────────────

    public async Task<List<OptionStrategyDto>> GetTopStrategiesAsync(
        OptionStrategyRequestDto request)
    {
        // 1. Fetch live option chain (throws if no data / no token)
        var chainResult = await _chain.GetOptionChainAsync(
            request.IndexName, request.Expiry);

        // 2. Try to get underlying tech indicators (may return null for index symbols)
        string? underlyingSymbol = IndexToUnderlyingSymbol
            .GetValueOrDefault(request.IndexName);
        TechnicalIndicators? tech = underlyingSymbol != null
            ? await _indicators.GetLatestIndicatorsAsync(underlyingSymbol)
            : null;

        // 3. Build market context
        var ctx = BuildContext(chainResult, tech, request.IndexName);

        // 4. Run all eligible generators
        var candidates = new List<OptionStrategyDto>();
        var generators  = GetGenerators(ctx);

        foreach (var gen in generators)
        {
            try
            {
                var s = gen(chainResult, ctx, request);
                if (s != null) candidates.Add(s);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Generator skipped");
            }
        }

        // 5. Score each candidate
        foreach (var s in candidates)
            s.FactorScores = Score(s, chainResult, ctx);

        // 6. Filter by capital and risk level
        if (request.CapitalBudget > 0)
            candidates = candidates
                .Where(s => s.MarginRequired <= request.CapitalBudget)
                .ToList();

        if (!string.IsNullOrEmpty(request.RiskLevel) && request.RiskLevel != "ALL")
            candidates = candidates
                .Where(s => string.Equals(s.RiskLevel, request.RiskLevel,
                    StringComparison.OrdinalIgnoreCase))
                .ToList();

        // 7. Rank by total score
        var ranked = candidates
            .OrderByDescending(s => s.FactorScores.TotalScore)
            .Take(request.TopN)
            .ToList();

        for (int i = 0; i < ranked.Count; i++)
            ranked[i].Rank = i + 1;

        // 8. Persist
        await PersistAsync(ranked, request.IndexName, request.Expiry);

        return ranked;
    }

    public async Task<OptionStrategyDto?> GetStrategyByIdAsync(Guid strategyId)
    {
        using var conn = new NpgsqlConnection(_conn);
        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT metrics_json FROM option_strategy_snapshots WHERE strategy_id = @Id",
            new { Id = strategyId });

        if (row == null) return null;
        return JsonConvert.DeserializeObject<OptionStrategyDto>((string)row.metrics_json);
    }

    // ─── Market Context ───────────────────────────────────────────────────

    private sealed record MarketCtx(
        string  IndexName,
        decimal SpotLTP,
        int     DTE,
        decimal ATMStrike,
        int     LotSize,
        decimal PCR,
        decimal MaxPain,
        double? AtmIV,
        double? IVPercentile,
        double? IVSkew,
        string  TrendBias,    // BULLISH / BEARISH / NEUTRAL
        double? RSI,
        bool?   GoldenCross,
        string  IVCondition   // IV_HIGH / IV_NORMAL / IV_LOW
    );

    private static MarketCtx BuildContext(
        OptionChainResultDto chain, TechnicalIndicators? tech, string indexName)
    {
        // Trend from tech indicators (null-safe)
        double? rsi       = tech?.RSI14 != null ? (double?)tech.RSI14 : null;
        bool?   golden    = tech?.IsGoldenCross;
        bool?   death     = tech?.IsDeathCross;

        string trendBias;
        if (tech == null)
            trendBias = "NEUTRAL";
        else
        {
            bool bullish = tech.RSI14 > 50m
                        && tech.IsGoldenCross == true
                        && tech.SMA20 > tech.SMA50;
            bool bearish = tech.RSI14 < 50m
                        && tech.IsDeathCross == true
                        && tech.SMA20 < tech.SMA50;
            trendBias = bullish ? "BULLISH" : bearish ? "BEARISH" : "NEUTRAL";
        }

        string ivCond = !chain.IVPercentile.HasValue ? "IV_NORMAL"
            : chain.IVPercentile > 70  ? "IV_HIGH"
            : chain.IVPercentile < 30  ? "IV_LOW"
            : "IV_NORMAL";

        decimal atm = chain.Chain
            .Select(c => c.Strike)
            .OrderBy(s => Math.Abs((double)(s - chain.UnderlyingLTP)))
            .FirstOrDefault();

        int lotSize = chain.Chain.FirstOrDefault()?.LotSize ?? 0;
        if (lotSize == 0)
            throw new InvalidOperationException(
                "Lot size is 0. Run Sync Instruments to populate NFO instruments.");

        return new MarketCtx(
            indexName, chain.UnderlyingLTP, chain.DTE, atm, lotSize,
            chain.PCR, chain.MaxPain, chain.AtmIV, chain.IVPercentile,
            chain.IVSkew, trendBias, rsi, golden, ivCond);
    }

    // ─── Generator Routing ────────────────────────────────────────────────

    private List<Func<OptionChainResultDto, MarketCtx, OptionStrategyRequestDto,
        OptionStrategyDto?>> GetGenerators(MarketCtx ctx)
    {
        var all = new List<Func<OptionChainResultDto, MarketCtx,
            OptionStrategyRequestDto, OptionStrategyDto?>>
        {
            GenIronCondor, GenIronButterfly,
            GenBullCallSpread, GenBearPutSpread,
            GenLongStraddle,   GenShortStraddle,
            GenLongStrangle,   GenShortStrangle,
            GenCallRatioSpread, GenPutRatioSpread,
            GenCoveredCall,    GenProtectivePut,
            GenCollar,         GenLongCall, GenLongPut,
        };

        if (ctx.IVCondition == "IV_HIGH")
        {
            all.Remove(GenLongStraddle);
            all.Remove(GenLongStrangle);
        }
        else if (ctx.IVCondition == "IV_LOW")
        {
            all.Remove(GenShortStraddle);
            all.Remove(GenShortStrangle);
            all.Remove(GenIronCondor);
        }

        if (ctx.DTE < 3) all.Remove(GenCalendarSpread);

        return all;
    }

    private static OptionStrategyDto? GenCalendarSpread(
        OptionChainResultDto c, MarketCtx ctx, OptionStrategyRequestDto r)
        => null; // Requires dual-expiry chain — Phase 2

    // ─── Strike Selector ─────────────────────────────────────────────────

    /// <summary>
    /// Returns the most-liquid option entry nearest to (spot × (1 + pctOffset))
    /// for the given option type. Returns null if no liquid entry found.
    /// </summary>
    private static OptionChainEntryDto? PickStrike(
        OptionChainResultDto chain, string optType, decimal spot,
        double pctOffset = 0.0)
    {
        decimal target = spot * (1m + (decimal)pctOffset);
        return chain.Chain
            .Where(c => c.OptionType == optType && c.LTP > 0 && c.OI > 0)
            .OrderBy(c => Math.Abs((double)(c.Strike - target)))
            .FirstOrDefault();
    }

    // ─── Leg Builder ─────────────────────────────────────────────────────

    private static OptionLegDto MakeLeg(
        OptionChainEntryDto e, string action, int lots = 1) => new()
    {
        OptionType    = e.OptionType == "CE" ? "CALL" : "PUT",
        Action        = action,
        Strike        = e.Strike,
        Expiry        = e.Expiry,
        EntryPrice    = e.LTP,
        Bid           = e.Bid,
        Ask           = e.Ask,
        LotSize       = e.LotSize,
        Lots          = lots,
        IV            = e.IV,
        IvUnavailable = e.IvUnavailable,
        OI            = e.OI,
        BidAskSpread  = e.Ask - e.Bid,
        TradingSymbol = e.TradingSymbol,
        Greeks        = new GreeksDto
        {
            Delta = e.Delta ?? 0,
            Gamma = e.Gamma ?? 0,
            Theta = e.Theta ?? 0,
            Vega  = e.Vega  ?? 0,
        }
    };

    // ─── Margin Estimation (simplified SPAN) ─────────────────────────────

    private static decimal EstimateMargin(
        List<OptionLegDto> legs, decimal spot, string indexName)
    {
        decimal pct = SpanPct.GetValueOrDefault(indexName, 0.105m);
        decimal sellMargin  = 0m;
        decimal buyPremium  = 0m;

        foreach (var leg in legs)
        {
            decimal units = leg.LotSize * leg.Lots;
            if (leg.Action == "SELL")
                sellMargin += spot * units * pct;
            else
                buyPremium += leg.EntryPrice * units;
        }

        return Math.Max(sellMargin - buyPremium, buyPremium);
    }

    // ─── Greeks Aggregation ───────────────────────────────────────────────

    private static GreeksDto AggregateGreeks(List<OptionLegDto> legs)
    {
        double Sgn(OptionLegDto l) => l.Action == "BUY" ? 1.0 : -1.0;
        double Units(OptionLegDto l) => l.LotSize * l.Lots;
        return new GreeksDto
        {
            Delta = legs.Sum(l => Sgn(l) * l.Greeks.Delta * Units(l)),
            Gamma = legs.Sum(l => Sgn(l) * l.Greeks.Gamma * Units(l)),
            Theta = legs.Sum(l => Sgn(l) * l.Greeks.Theta * Units(l)),
            Vega  = legs.Sum(l => Sgn(l) * l.Greeks.Vega  * Units(l)),
        };
    }

    // ─── Payoff Curve ─────────────────────────────────────────────────────

    private static List<PayoffPointDto> PayoffCurve(
        List<OptionLegDto> legs, decimal spot, int steps = 40)
    {
        decimal rng  = spot * 0.12m;
        decimal low  = spot - rng;
        decimal high = spot + rng;
        decimal step = (high - low) / steps;
        var pts = new List<PayoffPointDto>();

        for (decimal p = low; p <= high; p += step)
        {
            decimal pnl = 0;
            foreach (var leg in legs)
            {
                decimal intr = leg.OptionType == "CALL"
                    ? Math.Max(0, p - leg.Strike)
                    : Math.Max(0, leg.Strike - p);
                decimal legPnl = (intr - leg.EntryPrice) * leg.LotSize * leg.Lots;
                if (leg.Action == "SELL") legPnl = -legPnl;
                pnl += legPnl;
            }
            pts.Add(new PayoffPointDto { UnderlyingPrice = p, PnL = pnl });
        }
        return pts;
    }

    // ─── Risk Scenarios ───────────────────────────────────────────────────

    private static List<RiskScenarioDto> RiskScenarios(
        List<OptionLegDto> legs, decimal spot)
    {
        var cases = new[]
        {
            ("Spot +3% (IV flat)",    0.03m,   0m),
            ("Spot -3% (IV flat)",   -0.03m,   0m),
            ("Spot +5% (IV -10%)",    0.05m, -10m),
            ("Spot -5% (IV +10%)",   -0.05m,  10m),
            ("Spot flat (IV +20%)",   0.00m,  20m),
            ("Spot flat (IV -20%)",   0.00m, -20m),
        };
        return cases.Select(sc =>
        {
            decimal hyp = spot * (1m + sc.Item2);
            decimal pnl = 0;
            foreach (var leg in legs)
            {
                decimal intr = leg.OptionType == "CALL"
                    ? Math.Max(0, hyp - leg.Strike)
                    : Math.Max(0, leg.Strike - hyp);
                decimal dp = (intr - leg.EntryPrice) * leg.LotSize * leg.Lots;
                if (leg.Action == "SELL") dp = -dp;
                decimal vp = (decimal)(leg.Greeks.Vega * (double)sc.Item3
                           * leg.LotSize * leg.Lots);
                if (leg.Action == "SELL") vp = -vp;
                pnl += dp + vp;
            }
            return new RiskScenarioDto
            {
                Label          = sc.Item1,
                UnderlyingMove = sc.Item2 * 100,
                PnL            = pnl,
                IVChange       = sc.Item3
            };
        }).ToList();
    }

    private static string LiquidityStatus(List<OptionLegDto> legs)
    {
        if (!legs.Any()) return "ILLIQUID";
        double max = (double)legs
            .Where(l => l.EntryPrice > 0)
            .Select(l => l.BidAskSpread / l.EntryPrice * 100)
            .DefaultIfEmpty(100)
            .Max();
        return max < 2 ? "LIQUID" : max < 5 ? "MODERATE" : "ILLIQUID";
    }

    // ─── Generators ───────────────────────────────────────────────────────

    private static OptionStrategyDto? GenIronCondor(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var sc = PickStrike(chain, "CE", ctx.SpotLTP,  0.02);
        var bc = PickStrike(chain, "CE", ctx.SpotLTP,  0.04);
        var sp = PickStrike(chain, "PE", ctx.SpotLTP, -0.02);
        var bp = PickStrike(chain, "PE", ctx.SpotLTP, -0.04);
        if (sc == null || bc == null || sp == null || bp == null) return null;

        var legs   = new List<OptionLegDto>
            { MakeLeg(sc,"SELL"), MakeLeg(bc,"BUY"), MakeLeg(sp,"SELL"), MakeLeg(bp,"BUY") };
        decimal u  = sc.LotSize;
        decimal cr = (sc.LTP + sp.LTP - bc.LTP - bp.LTP) * u;
        if (cr <= 0) return null;
        decimal spd   = (bc.Strike - sc.Strike) * u;
        decimal maxL  = Math.Max(spd - cr, 0);
        decimal marg  = EstimateMargin(legs, ctx.SpotLTP, req.IndexName);

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Iron Condor",
            StrategyType = "SPREAD", Bias = "Neutral", RiskLevel = "Low",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = cr, MaxLoss = maxL,
            BreakEvens = new List<decimal> { sp.Strike - cr/u, sc.Strike + cr/u },
            MarginRequired = marg,
            RiskReward     = maxL == 0 ? 0 : Math.Round((double)(cr / maxL), 2),
            ExpectedROI    = marg == 0 ? 0 : Math.Round((double)(cr / marg) * 100, 2),
            PayoffCurve    = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios  = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition    = ctx.IVCondition,
            LiquidityStatus= LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Sell {sc.Strike}CE & {sp.Strike}PE (~2% OTM); " +
                $"Buy {bc.Strike}CE & {bp.Strike}PE (~4% OTM) for wing protection",
            AnalysisSummary =
                $"PCR {ctx.PCR:F2} | Max Pain {ctx.MaxPain:N0} | " +
                $"IV Pct {ctx.IVPercentile:F0}% | Trend {ctx.TrendBias}. " +
                $"Profits if {req.IndexName} stays between {sp.Strike - cr/u:N0}–{sc.Strike + cr/u:N0}.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenIronButterfly(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var ac = chain.Chain.FirstOrDefault(c => c.Strike == ctx.ATMStrike && c.OptionType == "CE" && c.LTP > 0);
        var ap = chain.Chain.FirstOrDefault(c => c.Strike == ctx.ATMStrike && c.OptionType == "PE" && c.LTP > 0);
        var wc = PickStrike(chain, "CE", ctx.SpotLTP,  0.03);
        var wp = PickStrike(chain, "PE", ctx.SpotLTP, -0.03);
        if (ac == null || ap == null || wc == null || wp == null) return null;

        var legs   = new List<OptionLegDto>
            { MakeLeg(ac,"SELL"), MakeLeg(wc,"BUY"), MakeLeg(ap,"SELL"), MakeLeg(wp,"BUY") };
        decimal u  = ac.LotSize;
        decimal cr = (ac.LTP + ap.LTP - wc.LTP - wp.LTP) * u;
        if (cr <= 0) return null;
        decimal spd  = (wc.Strike - ac.Strike) * u;
        decimal maxL = Math.Max(spd - cr, 0);
        decimal marg = EstimateMargin(legs, ctx.SpotLTP, req.IndexName);

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Iron Butterfly",
            StrategyType = "SPREAD", Bias = "Neutral", RiskLevel = "Medium",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = cr, MaxLoss = maxL,
            BreakEvens = new List<decimal>
                { ctx.ATMStrike - cr/u, ctx.ATMStrike + cr/u },
            MarginRequired = marg,
            RiskReward     = maxL == 0 ? 0 : Math.Round((double)(cr / maxL), 2),
            ExpectedROI    = marg == 0 ? 0 : Math.Round((double)(cr / marg) * 100, 2),
            PayoffCurve    = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios  = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition    = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic = $"Sell ATM {ctx.ATMStrike} straddle; buy ±3% OTM wings",
            AnalysisSummary      = $"Max profit if {req.IndexName} pins at {ctx.ATMStrike} on expiry.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenBullCallSpread(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var buy  = PickStrike(chain, "CE", ctx.SpotLTP, -0.005);
        var sell = PickStrike(chain, "CE", ctx.SpotLTP,  0.025);
        if (buy == null || sell == null || buy.Strike >= sell.Strike) return null;

        var legs  = new List<OptionLegDto> { MakeLeg(buy,"BUY"), MakeLeg(sell,"SELL") };
        decimal u = buy.LotSize;
        decimal cost = (buy.LTP - sell.LTP) * u;
        if (cost <= 0) return null;
        decimal maxP = (sell.Strike - buy.Strike) * u - cost;
        if (maxP <= 0) return null;
        decimal marg = cost; // debit spread — margin = cost

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Bull Call Spread",
            StrategyType = "SPREAD", Bias = "Bullish", RiskLevel = "Low",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = maxP, MaxLoss = cost,
            BreakEvens    = new List<decimal> { buy.Strike + cost/u },
            MarginRequired= marg,
            RiskReward    = cost == 0 ? 0 : Math.Round((double)(maxP/cost), 2),
            ExpectedROI   = cost == 0 ? 0 : Math.Round((double)(maxP/cost)*100, 2),
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Buy {buy.Strike}CE (ATM); sell {sell.Strike}CE (~2.5% OTM)",
            AnalysisSummary =
                $"Defined-risk bullish play. RSI {ctx.RSI:F1} | Trend {ctx.TrendBias}.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenBearPutSpread(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var buy  = PickStrike(chain, "PE", ctx.SpotLTP,  0.005);
        var sell = PickStrike(chain, "PE", ctx.SpotLTP, -0.025);
        if (buy == null || sell == null || buy.Strike <= sell.Strike) return null;

        var legs  = new List<OptionLegDto> { MakeLeg(buy,"BUY"), MakeLeg(sell,"SELL") };
        decimal u = buy.LotSize;
        decimal cost = (buy.LTP - sell.LTP) * u;
        if (cost <= 0) return null;
        decimal maxP = (buy.Strike - sell.Strike) * u - cost;
        if (maxP <= 0) return null;

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Bear Put Spread",
            StrategyType = "SPREAD", Bias = "Bearish", RiskLevel = "Low",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = maxP, MaxLoss = cost,
            BreakEvens    = new List<decimal> { buy.Strike - cost/u },
            MarginRequired= cost,
            RiskReward    = cost == 0 ? 0 : Math.Round((double)(maxP/cost), 2),
            ExpectedROI   = cost == 0 ? 0 : Math.Round((double)(maxP/cost)*100, 2),
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Buy {buy.Strike}PE (ATM); sell {sell.Strike}PE (~2.5% OTM)",
            AnalysisSummary = $"Bearish bias. RSI {ctx.RSI:F1} | Trend {ctx.TrendBias}.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenLongStraddle(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var c = chain.Chain.FirstOrDefault(x => x.Strike == ctx.ATMStrike && x.OptionType == "CE" && x.LTP > 0);
        var p = chain.Chain.FirstOrDefault(x => x.Strike == ctx.ATMStrike && x.OptionType == "PE" && x.LTP > 0);
        if (c == null || p == null) return null;

        var legs  = new List<OptionLegDto> { MakeLeg(c,"BUY"), MakeLeg(p,"BUY") };
        decimal u = c.LotSize;
        decimal cost = (c.LTP + p.LTP) * u;

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Long Straddle",
            StrategyType = "VOLATILITY", Bias = "VolatilityLong", RiskLevel = "Medium",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = 0, IsMaxProfitUnlimited = true, MaxLoss = cost,
            BreakEvens    = new List<decimal> { ctx.ATMStrike - cost/u, ctx.ATMStrike + cost/u },
            MarginRequired= cost,
            RiskReward    = 0, ExpectedROI = 0,
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Buy ATM {ctx.ATMStrike} call + put — profits from large move either side",
            AnalysisSummary =
                $"IV Pct {ctx.IVPercentile:F0}% — options are cheap, vol expansion expected.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenShortStraddle(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var c = chain.Chain.FirstOrDefault(x => x.Strike == ctx.ATMStrike && x.OptionType == "CE" && x.LTP > 0);
        var p = chain.Chain.FirstOrDefault(x => x.Strike == ctx.ATMStrike && x.OptionType == "PE" && x.LTP > 0);
        if (c == null || p == null) return null;

        var legs   = new List<OptionLegDto> { MakeLeg(c,"SELL"), MakeLeg(p,"SELL") };
        decimal u  = c.LotSize;
        decimal cr = (c.LTP + p.LTP) * u;
        decimal marg = EstimateMargin(legs, ctx.SpotLTP, req.IndexName);

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Short Straddle",
            StrategyType = "VOLATILITY", Bias = "VolatilityShort", RiskLevel = "High",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = cr, MaxLoss = 0, IsMaxLossUnlimited = true,
            BreakEvens    = new List<decimal> { ctx.ATMStrike - cr/u, ctx.ATMStrike + cr/u },
            MarginRequired= marg,
            RiskReward    = 0,
            ExpectedROI   = marg == 0 ? 0 : Math.Round((double)(cr/marg)*100, 2),
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Sell ATM {ctx.ATMStrike} call + put — profit from theta & IV crush",
            AnalysisSummary =
                $"IV Pct {ctx.IVPercentile:F0}% — premium elevated, IV crush favored. " +
                $"PCR {ctx.PCR:F2}.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenLongStrangle(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var c = PickStrike(chain, "CE", ctx.SpotLTP,  0.025);
        var p = PickStrike(chain, "PE", ctx.SpotLTP, -0.025);
        if (c == null || p == null) return null;

        var legs  = new List<OptionLegDto> { MakeLeg(c,"BUY"), MakeLeg(p,"BUY") };
        decimal u = c.LotSize;
        decimal cost = (c.LTP + p.LTP) * u;

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Long Strangle",
            StrategyType = "VOLATILITY", Bias = "VolatilityLong", RiskLevel = "Medium",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = 0, IsMaxProfitUnlimited = true, MaxLoss = cost,
            BreakEvens    = new List<decimal> { p.Strike - cost/u, c.Strike + cost/u },
            MarginRequired= cost, RiskReward = 0, ExpectedROI = 0,
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Buy {p.Strike}PE + {c.Strike}CE (~2.5% OTM each) — wider break-evens, lower cost",
            AnalysisSummary = "Cheaper than straddle. Needs bigger move to profit.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenShortStrangle(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var c = PickStrike(chain, "CE", ctx.SpotLTP,  0.030);
        var p = PickStrike(chain, "PE", ctx.SpotLTP, -0.030);
        if (c == null || p == null) return null;

        var legs   = new List<OptionLegDto> { MakeLeg(c,"SELL"), MakeLeg(p,"SELL") };
        decimal u  = c.LotSize;
        decimal cr = (c.LTP + p.LTP) * u;
        decimal marg = EstimateMargin(legs, ctx.SpotLTP, req.IndexName);

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Short Strangle",
            StrategyType = "VOLATILITY", Bias = "VolatilityShort", RiskLevel = "High",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = cr, MaxLoss = 0, IsMaxLossUnlimited = true,
            BreakEvens    = new List<decimal> { p.Strike - cr/u, c.Strike + cr/u },
            MarginRequired= marg, RiskReward = 0,
            ExpectedROI   = marg == 0 ? 0 : Math.Round((double)(cr/marg)*100, 2),
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Sell {p.Strike}PE + {c.Strike}CE (~3% OTM each) — wider range than straddle",
            AnalysisSummary =
                $"IV Pct {ctx.IVPercentile:F0}%. Premium-rich environment.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenCallRatioSpread(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var buy  = PickStrike(chain, "CE", ctx.SpotLTP, -0.01);
        var sell = PickStrike(chain, "CE", ctx.SpotLTP,  0.02);
        if (buy == null || sell == null || buy.Strike >= sell.Strike) return null;

        var legs   = new List<OptionLegDto>
            { MakeLeg(buy,"BUY",1), MakeLeg(sell,"SELL",2) };
        decimal u  = buy.LotSize;
        decimal cr = (sell.LTP * 2 - buy.LTP) * u;
        decimal maxP = (sell.Strike - buy.Strike) * u + cr;
        decimal marg = EstimateMargin(legs, ctx.SpotLTP, req.IndexName);

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Call Ratio Spread (1×2)",
            StrategyType = "SPREAD", Bias = "Neutral-Bullish", RiskLevel = "High",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = maxP, MaxLoss = 0, IsMaxLossUnlimited = true,
            BreakEvens = new List<decimal>
            {
                buy.Strike - cr/u,
                2 * sell.Strike - buy.Strike + cr/u
            },
            MarginRequired = marg, RiskReward = 0,
            ExpectedROI    = marg == 0 ? 0 : Math.Round((double)(maxP/marg)*100, 2),
            PayoffCurve    = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios  = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition    = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Buy 1× {buy.Strike}CE; sell 2× {sell.Strike}CE — near zero-cost",
            AnalysisSummary =
                "Profits in mild bullish move. Unlimited loss above upper break-even.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenPutRatioSpread(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var buy  = PickStrike(chain, "PE", ctx.SpotLTP,  0.01);
        var sell = PickStrike(chain, "PE", ctx.SpotLTP, -0.02);
        if (buy == null || sell == null || buy.Strike <= sell.Strike) return null;

        var legs   = new List<OptionLegDto>
            { MakeLeg(buy,"BUY",1), MakeLeg(sell,"SELL",2) };
        decimal u  = buy.LotSize;
        decimal cr = (sell.LTP * 2 - buy.LTP) * u;
        decimal maxP = (buy.Strike - sell.Strike) * u + cr;
        decimal marg = EstimateMargin(legs, ctx.SpotLTP, req.IndexName);

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Put Ratio Spread (1×2)",
            StrategyType = "SPREAD", Bias = "Neutral-Bearish", RiskLevel = "High",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = maxP, MaxLoss = 0, IsMaxLossUnlimited = true,
            BreakEvens = new List<decimal>
            {
                buy.Strike + cr/u,
                2 * sell.Strike - buy.Strike - cr/u
            },
            MarginRequired = marg, RiskReward = 0,
            ExpectedROI    = marg == 0 ? 0 : Math.Round((double)(maxP/marg)*100, 2),
            PayoffCurve    = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios  = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition    = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Buy 1× {buy.Strike}PE; sell 2× {sell.Strike}PE — near zero-cost",
            AnalysisSummary = "Profits in mild bearish move. Unlimited loss below lower break-even.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenCoveredCall(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var otmC = PickStrike(chain, "CE", ctx.SpotLTP, 0.025);
        if (otmC == null) return null;

        var legs   = new List<OptionLegDto> { MakeLeg(otmC,"SELL") };
        decimal u  = otmC.LotSize;
        decimal cr = otmC.LTP * u;
        decimal marg = EstimateMargin(legs, ctx.SpotLTP, req.IndexName);

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Covered Call",
            StrategyType = "HEDGED", Bias = "Neutral-Bullish", RiskLevel = "Medium",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = (otmC.Strike - ctx.SpotLTP + otmC.LTP) * u,
            MaxLoss   = ctx.SpotLTP * u,
            BreakEvens    = new List<decimal> { ctx.SpotLTP - cr/u },
            MarginRequired= marg,
            RiskReward    = marg == 0 ? 0 : Math.Round((double)(cr/marg), 2),
            ExpectedROI   = marg == 0 ? 0 : Math.Round((double)(cr/marg)*100, 2),
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Sell {otmC.Strike}CE (~2.5% OTM) against existing long futures",
            AnalysisSummary = "Income strategy. Collects premium, caps upside.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenProtectivePut(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var otmP = PickStrike(chain, "PE", ctx.SpotLTP, -0.02);
        if (otmP == null) return null;

        var legs  = new List<OptionLegDto> { MakeLeg(otmP,"BUY") };
        decimal u = otmP.LotSize;
        decimal cost = otmP.LTP * u;

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Protective Put",
            StrategyType = "HEDGED", Bias = "Bullish", RiskLevel = "Low",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = 0, IsMaxProfitUnlimited = true,
            MaxLoss   = (ctx.SpotLTP - otmP.Strike + otmP.LTP) * u,
            BreakEvens    = new List<decimal> { ctx.SpotLTP + cost/u },
            MarginRequired= cost, RiskReward = 0, ExpectedROI = 0,
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Buy {otmP.Strike}PE (~2% OTM) as hedge against long futures",
            AnalysisSummary = "Insurance. Caps downside to defined loss.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenCollar(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var c = PickStrike(chain, "CE", ctx.SpotLTP,  0.025);
        var p = PickStrike(chain, "PE", ctx.SpotLTP, -0.025);
        if (c == null || p == null) return null;

        var legs   = new List<OptionLegDto> { MakeLeg(c,"SELL"), MakeLeg(p,"BUY") };
        decimal u  = c.LotSize;
        decimal net = (c.LTP - p.LTP) * u;
        decimal marg = EstimateMargin(legs, ctx.SpotLTP, req.IndexName);

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Collar",
            StrategyType = "HEDGED", Bias = "Neutral", RiskLevel = "Low",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = (c.Strike - ctx.SpotLTP) * u + net,
            MaxLoss   = (ctx.SpotLTP - p.Strike) * u - net,
            BreakEvens    = new List<decimal> { ctx.SpotLTP - net/u },
            MarginRequired= marg,
            RiskReward    = 1.0,
            ExpectedROI   = marg == 0 ? 0 : Math.Round((double)(net/marg)*100, 2),
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic =
                $"Sell {c.Strike}CE + buy {p.Strike}PE — brackets long futures",
            AnalysisSummary = "Near-zero cost. Caps both upside and downside.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenLongCall(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var c = chain.Chain.FirstOrDefault(x => x.Strike == ctx.ATMStrike && x.OptionType == "CE" && x.LTP > 0)
             ?? PickStrike(chain, "CE", ctx.SpotLTP, 0);
        if (c == null) return null;

        var legs  = new List<OptionLegDto> { MakeLeg(c,"BUY") };
        decimal u = c.LotSize;
        decimal cost = c.LTP * u;

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Long Call",
            StrategyType = "DIRECTIONAL", Bias = "Bullish", RiskLevel = "Medium",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = 0, IsMaxProfitUnlimited = true, MaxLoss = cost,
            BreakEvens    = new List<decimal> { c.Strike + c.LTP },
            MarginRequired= cost, RiskReward = 0, ExpectedROI = 0,
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic = $"Buy ATM {c.Strike}CE — full upside participation",
            AnalysisSummary =
                $"Strong bullish bias. RSI {ctx.RSI:F1} | Golden Cross: {ctx.GoldenCross}.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static OptionStrategyDto? GenLongPut(
        OptionChainResultDto chain, MarketCtx ctx, OptionStrategyRequestDto req)
    {
        var p = chain.Chain.FirstOrDefault(x => x.Strike == ctx.ATMStrike && x.OptionType == "PE" && x.LTP > 0)
             ?? PickStrike(chain, "PE", ctx.SpotLTP, 0);
        if (p == null) return null;

        var legs  = new List<OptionLegDto> { MakeLeg(p,"BUY") };
        decimal u = p.LotSize;
        decimal cost = p.LTP * u;

        return new OptionStrategyDto
        {
            StrategyId   = Guid.NewGuid(), Name = "Long Put",
            StrategyType = "DIRECTIONAL", Bias = "Bearish", RiskLevel = "Medium",
            Legs = legs, NetGreeks = AggregateGreeks(legs),
            MaxProfit = p.Strike * u - cost, MaxLoss = cost,
            BreakEvens    = new List<decimal> { p.Strike - p.LTP },
            MarginRequired= cost,
            RiskReward    = cost == 0 ? 0 : Math.Round((double)(p.Strike * u - cost) / (double)cost, 2),
            ExpectedROI   = 0,
            PayoffCurve   = PayoffCurve(legs, ctx.SpotLTP),
            RiskScenarios = RiskScenarios(legs, ctx.SpotLTP),
            IVCondition   = ctx.IVCondition, LiquidityStatus = LiquidityStatus(legs),
            StrikeSelectionLogic = $"Buy ATM {p.Strike}PE — profits from downside",
            AnalysisSummary = $"Bearish conviction. RSI {ctx.RSI:F1}.",
            GeneratedAt = DateTime.UtcNow
        };
    }

    // ─── Scoring ──────────────────────────────────────────────────────────

    private static OptionFactorScoresDto Score(
        OptionStrategyDto s, OptionChainResultDto chain, MarketCtx ctx)
    {
        double trend = ScoreTrend(s, ctx);
        double iv    = ScoreIV(s, ctx);
        double oi    = ScoreOI(s, chain, ctx);
        double liq   = ScoreLiq(s);
        double risk  = ScoreRisk(s);
        double greek = ScoreGreeks(s);

        double total = trend   * W_Trend
                     + iv      * W_IV
                     + oi      * W_OI
                     + liq     * W_Liquidity
                     + risk    * W_Risk
                     + greek   * W_Greeks;

        s.Confidence = Math.Round(total, 1);

        return new OptionFactorScoresDto
        {
            TrendAlignment = Math.Round(trend,  1),
            IVSuitability  = Math.Round(iv,     1),
            OIConfirmation = Math.Round(oi,     1),
            LiquidityScore = Math.Round(liq,    1),
            RiskEfficiency = Math.Round(risk,   1),
            GreekStability = Math.Round(greek,  1),
            TotalScore     = Math.Round(total,  2),
        };
    }

    private static double ScoreTrend(OptionStrategyDto s, MarketCtx ctx)
    {
        bool match = s.Bias switch
        {
            "Bullish"         => ctx.TrendBias == "BULLISH",
            "Bearish"         => ctx.TrendBias == "BEARISH",
            "Neutral"         => ctx.TrendBias == "NEUTRAL",
            "VolatilityLong"  => ctx.TrendBias == "NEUTRAL",
            "VolatilityShort" => ctx.TrendBias == "NEUTRAL",
            "Neutral-Bullish" => ctx.TrendBias is "NEUTRAL" or "BULLISH",
            "Neutral-Bearish" => ctx.TrendBias is "NEUTRAL" or "BEARISH",
            _                 => false
        };
        double score = match ? 80 : 20;
        if (ctx.RSI.HasValue)
        {
            double rsi = ctx.RSI.Value;
            if (s.Bias == "Bullish"  && rsi is > 50 and < 70) score += 20;
            if (s.Bias == "Bearish"  && rsi is > 30 and < 50) score += 20;
            if (s.Bias is "Neutral" or "VolatilityLong" or "VolatilityShort"
                && rsi is > 45 and < 55) score += 20;
        }
        return Math.Min(score, 100);
    }

    private static double ScoreIV(OptionStrategyDto s, MarketCtx ctx)
    {
        if (!ctx.IVPercentile.HasValue) return 50;
        double p = ctx.IVPercentile.Value;
        bool isLongVol  = s.StrategyType == "VOLATILITY"
            && s.Legs.All(l => l.Action == "BUY");
        bool isShortVol = s.StrategyType == "VOLATILITY"
            && s.Legs.Any(l => l.Action == "SELL");
        if (isLongVol)  return p < 30 ? 100 : p < 50 ? 70 : 20;
        if (isShortVol) return p > 70 ? 100 : p > 50 ? 70 : 20;
        return p < 50 ? 90 : 60; // spreads work in normal/low IV
    }

    private static double ScoreOI(
        OptionStrategyDto s, OptionChainResultDto chain, MarketCtx ctx)
    {
        double score = 50;
        if (s.Bias == "Bullish"  && chain.PCR > 1.0m)  score += 20;
        if (s.Bias == "Bearish"  && chain.PCR < 0.8m)  score += 20;
        if (s.Bias == "Neutral"  && chain.PCR is > 0.8m and < 1.2m) score += 20;
        decimal dev = ctx.ATMStrike == 0 ? 1m
            : Math.Abs(ctx.MaxPain - ctx.ATMStrike) / ctx.ATMStrike;
        if (dev < 0.01m) score += 20;
        else if (dev < 0.02m) score += 10;
        if (s.Legs.All(l => l.OI > 1000)) score += 10;
        return Math.Min(score, 100);
    }

    private static double ScoreLiq(OptionStrategyDto s)
    {
        if (!s.Legs.Any()) return 0;
        double avgSpd = (double)s.Legs
            .Where(l => l.EntryPrice > 0)
            .Select(l => l.BidAskSpread / l.EntryPrice * 100)
            .DefaultIfEmpty(10)
            .Average();
        bool hasOI = s.Legs.All(l => l.OI > 500);
        double score = 100 - avgSpd * 5;
        if (!hasOI) score *= 0.7;
        return Math.Max(0, Math.Min(score, 100));
    }

    private static double ScoreRisk(OptionStrategyDto s)
    {
        if (s.IsMaxLossUnlimited) return 20;
        if (s.MaxLoss == 0) return 100;
        double rr = s.IsMaxProfitUnlimited
            ? 5.0
            : (double)(s.MaxProfit / s.MaxLoss);
        return Math.Min(100, 30 + rr * 20);
    }

    private static double ScoreGreeks(OptionStrategyDto s)
    {
        double score = 100;
        score -= Math.Min(40, Math.Abs(s.NetGreeks.Gamma) * 10000);
        if (s.NetGreeks.Theta < 0) score -= 20;
        else score += 10;
        score -= Math.Min(20, Math.Abs(s.NetGreeks.Vega) * 2);
        return Math.Max(0, Math.Min(score, 100));
    }

    // ─── Persistence ──────────────────────────────────────────────────────

    private async Task PersistAsync(
        List<OptionStrategyDto> strategies, string indexName, DateOnly expiry)
    {
        using var conn = new NpgsqlConnection(_conn);
        foreach (var s in strategies)
        {
            try
            {
                await conn.ExecuteAsync(@"
                    INSERT INTO option_strategy_snapshots
                        (strategy_id, index_name, expiry_date, strategy_name, strategy_type,
                         bias, confidence, total_score, rank,
                         legs_json, greeks_json, metrics_json, factor_scores, generated_at)
                    VALUES
                        (@StrategyId, @IndexName, @Expiry, @Name, @StrategyType,
                         @Bias, @Confidence, @TotalScore, @Rank,
                         @Legs::jsonb, @Greeks::jsonb, @Metrics::jsonb, @Factors::jsonb, NOW())
                    ON CONFLICT DO NOTHING",
                    new
                    {
                        s.StrategyId,
                        IndexName  = indexName,
                        Expiry     = expiry.ToDateTime(TimeOnly.MinValue),
                        s.Name, s.StrategyType, s.Bias, s.Confidence,
                        TotalScore = s.FactorScores.TotalScore,
                        s.Rank,
                        Legs    = JsonConvert.SerializeObject(s.Legs),
                        Greeks  = JsonConvert.SerializeObject(s.NetGreeks),
                        Metrics = JsonConvert.SerializeObject(s),
                        Factors = JsonConvert.SerializeObject(s.FactorScores)
                    });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to persist strategy {Name}", s.Name);
            }
        }
    }
}
