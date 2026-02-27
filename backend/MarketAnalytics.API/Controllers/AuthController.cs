using System;
using System.Threading.Tasks;
using MarketAnalytics.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MarketAnalytics.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IKiteConnectService _kiteService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IKiteConnectService kiteService, ILogger<AuthController> logger)
    {
        _kiteService = kiteService;
        _logger = logger;
    }

    [HttpGet("login-url")]
    public async Task<IActionResult> GetLoginUrl()
    {
        var url = await _kiteService.GetLoginUrlAsync();
        return Ok(new { loginUrl = url });
    }

    [HttpPost("session")]
    public async Task<IActionResult> GenerateSession([FromBody] SessionRequest request)
    {
        try
        {
            var response = await _kiteService.GenerateSessionAsync(request.RequestToken);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Session generation failed");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("validate")]
    public async Task<IActionResult> ValidateToken()
    {
        var token = await _kiteService.GetActiveAccessTokenAsync();
        if (string.IsNullOrEmpty(token))
            return Unauthorized(new { error = "No active token" });

        var isValid = await _kiteService.ValidateTokenAsync(token);
        return Ok(new { isValid, token });
    }
}

public record SessionRequest(string RequestToken);
