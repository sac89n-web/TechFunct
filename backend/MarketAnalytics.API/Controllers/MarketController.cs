using System;
using System.Threading.Tasks;
using MarketAnalytics.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MarketAnalytics.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarketController : ControllerBase
{
    private readonly IMarketAnalyticsService _analyticsService;
    private readonly ILogger<MarketController> _logger;

    public MarketController(IMarketAnalyticsService analyticsService, ILogger<MarketController> logger)
    {
        _analyticsService = analyticsService;
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
}
