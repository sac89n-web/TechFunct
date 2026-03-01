using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace MarketAnalytics.API.Controllers;

[ApiController]
[Route("api/options")]
public class OptionsController : ControllerBase
{
    private readonly IOptionsChainService  _chainService;
    private readonly IOptionStrategyEngine _strategyEngine;
    private readonly IInstrumentService    _instrumentService;
    private readonly ILogger<OptionsController> _logger;

    // Option-enabled indices exposed to the frontend
    private static readonly IReadOnlyList<object> _indices = new List<object>
    {
        new { value = "NIFTY50",      label = "NIFTY 50",          kiteSymbol = "NIFTY" },
        new { value = "BANKNIFTY",    label = "NIFTY BANK",        kiteSymbol = "BANKNIFTY" },
        new { value = "FINNIFTY",     label = "NIFTY FIN SERVICE", kiteSymbol = "FINNIFTY" },
        new { value = "MIDCAPNIFTY",  label = "NIFTY MIDCAP SEL",  kiteSymbol = "MIDCPNIFTY" },
        new { value = "SENSEX",       label = "SENSEX",            kiteSymbol = "SENSEX" },
    };

    public OptionsController(
        IOptionsChainService  chainService,
        IOptionStrategyEngine strategyEngine,
        IInstrumentService    instrumentService,
        ILogger<OptionsController> logger)
    {
        _chainService      = chainService;
        _strategyEngine    = strategyEngine;
        _instrumentService = instrumentService;
        _logger            = logger;
    }

    // GET /api/options/indices
    // Returns the list of indices for which options are supported.
    [HttpGet("indices")]
    public IActionResult GetIndices() => Ok(_indices);

    // GET /api/options/expiries/{index}
    // Returns available expiry dates for the given index (from instrument_master).
    [HttpGet("expiries/{index}")]
    public async Task<IActionResult> GetExpiries(string index)
    {
        try
        {
            var expiries = await _chainService.GetExpiriesAsync(index);
            return Ok(expiries);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetExpiries failed for {Index}", index);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // GET /api/options/chain?index=NIFTY50&expiry=2025-01-30
    // Returns full option chain with Greeks, PCR, MaxPain, IV metrics.
    [HttpGet("chain")]
    public async Task<IActionResult> GetChain(
        [FromQuery] string index  = "NIFTY50",
        [FromQuery] string expiry = "")
    {
        try
        {
            if (!DateOnly.TryParse(expiry, out var expiryDate))
            {
                // Default to nearest expiry
                var expiries = await _chainService.GetExpiriesAsync(index);
                if (expiries.Count == 0)
                    return BadRequest(new { error = $"No expiries found for {index}. Run sync-instruments first." });
                expiryDate = expiries[0];
            }

            var chain = await _chainService.GetOptionChainAsync(index, expiryDate);
            return Ok(chain);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "GetChain invalid state for {Index}", index);
            return StatusCode(503, new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetChain failed for {Index} {Expiry}", index, expiry);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // POST /api/options/strategies/top
    // Generates and ranks top N option strategies for the given index/expiry.
    [HttpPost("strategies/top")]
    public async Task<IActionResult> GetTopStrategies([FromBody] OptionStrategyRequestDto request)
    {
        try
        {
            var strategies = await _strategyEngine.GetTopStrategiesAsync(request);
            return Ok(strategies);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "GetTopStrategies invalid state");
            return StatusCode(503, new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetTopStrategies failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // GET /api/options/strategy/{id}
    // Returns a previously generated strategy snapshot by its UUID.
    [HttpGet("strategy/{id:guid}")]
    public async Task<IActionResult> GetStrategy(Guid id)
    {
        try
        {
            var strategy = await _strategyEngine.GetStrategyByIdAsync(id);
            if (strategy is null)
                return NotFound(new { error = $"Strategy {id} not found" });
            return Ok(strategy);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetStrategy failed for {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // POST /api/options/sync
    // Triggers a manual NFO/BFO instrument sync (lightweight — options only).
    [HttpPost("sync")]
    public async Task<IActionResult> SyncOptionInstruments()
    {
        try
        {
            await _instrumentService.SyncOptionInstrumentsAsync();
            return Ok(new { message = "NFO/BFO option instruments synced successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SyncOptionInstruments failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // GET /api/options/metrics?index=NIFTY50
    // Returns current market metrics (spot, PCR, MaxPain, ATM IV, DTE) for the nearest expiry.
    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics([FromQuery] string index = "NIFTY50")
    {
        try
        {
            var expiries = await _chainService.GetExpiriesAsync(index);
            if (expiries.Count == 0)
                return BadRequest(new { error = $"No expiries found for {index}. Run sync-instruments first." });

            var nearest = expiries[0];
            var chain   = await _chainService.GetOptionChainAsync(index, nearest);

            var dte = (nearest.ToDateTime(TimeOnly.MinValue) - DateTime.Today).Days;
            var atmStrike = chain.Chain.Count > 0
                ? chain.Chain
                    .OrderBy(c => Math.Abs((double)(c.Strike - chain.UnderlyingLTP)))
                    .First().Strike
                : 0m;

            var metrics = new OptionsMarketMetricsDto
            {
                IndexName     = index,
                UnderlyingLTP = chain.UnderlyingLTP,
                ATMStrike     = atmStrike,
                AtmIV         = chain.AtmIV,
                IVPercentile  = chain.IVPercentile,
                PCR           = chain.PCR,
                MaxPain       = chain.MaxPain,
                IVSkew        = chain.IVSkew,
                IVCondition   = chain.AtmIV.HasValue
                    ? (chain.IVPercentile >= 70 ? "IV_HIGH" : chain.IVPercentile <= 30 ? "IV_LOW" : "IV_NORMAL")
                    : "UNKNOWN",
                DTE           = dte,
            };

            return Ok(metrics);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "GetMetrics invalid state for {Index}", index);
            return StatusCode(503, new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetMetrics failed for {Index}", index);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
