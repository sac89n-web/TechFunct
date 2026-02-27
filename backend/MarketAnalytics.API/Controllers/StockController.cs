using System;
using System.Threading.Tasks;
using MarketAnalytics.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MarketAnalytics.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StockController : ControllerBase
{
    private readonly IMarketAnalyticsService _analyticsService;
    private readonly ILogger<StockController> _logger;

    public StockController(IMarketAnalyticsService analyticsService, ILogger<StockController> logger)
    {
        _analyticsService = analyticsService;
        _logger = logger;
    }

    [HttpGet("analyze")]
    public async Task<IActionResult> AnalyzeStock([FromQuery] string symbol)
    {
        if (string.IsNullOrWhiteSpace(symbol))
            return BadRequest(new { error = "Symbol is required" });

        try
        {
            var analysis = await _analyticsService.GetStockAnalysisAsync(symbol.ToUpper());
            
            if (analysis == null)
                return NotFound(new { error = $"Stock {symbol} not found or no data available" });

            return Ok(analysis);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stock analysis failed for {Symbol}", symbol);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
