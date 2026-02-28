using System;
using System.Threading.Tasks;
using MarketAnalytics.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MarketAnalytics.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StrategiesController : ControllerBase
{
    private readonly IStrategyService _strategyService;
    private readonly ILogger<StrategiesController> _logger;

    public StrategiesController(IStrategyService strategyService, ILogger<StrategiesController> logger)
    {
        _strategyService = strategyService;
        _logger = logger;
    }

    /// <summary>
    /// Returns the top 10 strategy-ranked stocks for the given index,
    /// each scored against 47 technical/momentum factors.
    /// </summary>
    [HttpGet("top10")]
    public async Task<IActionResult> GetTop10([FromQuery] string index = "NIFTY50")
    {
        try
        {
            var results = await _strategyService.GetTop10StrategiesAsync(index);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Top10 strategy ranking failed for index {Index}", index);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
