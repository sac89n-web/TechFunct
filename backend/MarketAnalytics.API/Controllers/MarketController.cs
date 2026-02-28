using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MarketAnalytics.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MarketAnalytics.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarketController : ControllerBase
{
    private readonly IMarketAnalyticsService _analyticsService;
    private readonly IInstrumentService _instrumentService;
    private readonly IHistoricalDataService _historicalDataService;
    private readonly IIndicatorEngine _indicatorEngine;
    private readonly ILogger<MarketController> _logger;

    // All index symbols we want to track (union of all index constituents)
    private static readonly string[] AllTrackedIndices = { "NIFTY50", "NIFTY BANK", "NIFTY IT", "NIFTY PHARMA", "NIFTY AUTO", "NIFTY FMCG" };

    public MarketController(
        IMarketAnalyticsService analyticsService,
        IInstrumentService instrumentService,
        IHistoricalDataService historicalDataService,
        IIndicatorEngine indicatorEngine,
        ILogger<MarketController> logger)
    {
        _analyticsService = analyticsService;
        _instrumentService = instrumentService;
        _historicalDataService = historicalDataService;
        _indicatorEngine = indicatorEngine;
        _logger = logger;
    }

    [HttpGet("heatmap")]
    public async Task<IActionResult> GetHeatmap([FromQuery] string index = "NIFTY50")
    {
        try
        {
            var heatmap = await _analyticsService.GetHeatmapAsync(index);
            return Ok(heatmap);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Heatmap generation failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("momentum")]
    public async Task<IActionResult> GetMomentumScanner([FromQuery] string index = "NIFTY50")
    {
        try
        {
            var momentum = await _analyticsService.GetMomentumScannerAsync(index);
            return Ok(momentum);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Momentum scanner failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("breadth")]
    public async Task<IActionResult> GetMarketBreadth([FromQuery] string index = "NIFTY50")
    {
        try
        {
            var breadth = await _analyticsService.GetMarketBreadthAsync(index);
            return Ok(breadth);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Market breadth calculation failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("sync-instruments")]
    public async Task<IActionResult> SyncInstruments()
    {
        try
        {
            // Step 1: Download instruments CSV from Kite and save to instrument_master
            await _instrumentService.SyncInstrumentsAsync();

            // Step 2: Collect all unique symbols across all tracked indices
            var allSymbols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var idx in AllTrackedIndices)
            {
                var syms = await _instrumentService.GetIndexSymbolsAsync(idx);
                allSymbols.UnionWith(syms);
            }

            // Step 3: Look up full instrument records (including tokens) for those symbols
            var instruments = await _instrumentService.GetInstrumentsBySymbolsAsync(allSymbols);
            if (!instruments.Any())
                return Ok(new { message = "Instruments synced but no index constituents found in DB." });

            // Step 4: Seed market_snapshot with live quotes from Kite REST API
            await _instrumentService.SeedMarketSnapshotAsync(instruments);

            // Step 5: Fetch 1 year of daily candles for each instrument (concurrency = 5)
            var from = DateTime.Today.AddYears(-1);
            var to = DateTime.Today;
            var semaphore = new SemaphoreSlim(5, 5);
            var historyTasks = instruments.Select(async inst =>
            {
                await semaphore.WaitAsync();
                try
                {
                    await _historicalDataService.SyncHistoricalDataAsync(
                        inst.InstrumentToken, inst.TradingSymbol, "day", from, to);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Historical data fetch failed for {Symbol}", inst.TradingSymbol);
                }
                finally
                {
                    semaphore.Release();
                }
            });
            await Task.WhenAll(historyTasks);

            // Step 6: Calculate technical indicators from the fetched historical data
            var symbols = instruments.Select(i => i.TradingSymbol).ToList();
            await _indicatorEngine.BatchCalculateIndicatorsAsync(symbols);

            // Step 7: Calculate momentum scores (signal + composite score) for all symbols
            await _indicatorEngine.CalculateMomentumScoresAsync(symbols);

            return Ok(new
            {
                message = $"Full sync complete: {instruments.Count} stocks — quotes, history, indicators, and momentum scores updated."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Full sync failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("indices")]
    public IActionResult GetIndices()
    {
        var indices = new[]
        {
            new { value = "NIFTY50",     label = "NIFTY 50" },
            new { value = "NIFTY BANK",  label = "NIFTY BANK" },
            new { value = "NIFTY IT",    label = "NIFTY IT" },
            new { value = "NIFTY PHARMA",label = "NIFTY PHARMA" },
            new { value = "NIFTY AUTO",  label = "NIFTY AUTO" },
            new { value = "NIFTY FMCG",  label = "NIFTY FMCG" },
        };
        return Ok(indices);
    }

    [HttpGet("index-quotes")]
    public async Task<IActionResult> GetIndexQuotes()
    {
        try
        {
            var quotes = await _analyticsService.GetIndexQuotesAsync();
            return Ok(quotes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Index quotes fetch failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
