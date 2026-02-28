using System;
using System.Threading.Tasks;
using MarketAnalytics.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace MarketAnalytics.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IKiteConnectService _kiteService;
    private readonly ILogger<AuthController> _logger;
    private readonly string _frontendUrl;

    public AuthController(IKiteConnectService kiteService, ILogger<AuthController> logger, IConfiguration config)
    {
        _kiteService = kiteService;
        _logger = logger;
        _frontendUrl = config["FrontendUrl"] ?? "http://127.0.0.1:3000";
    }

    // Redirect browser directly to Kite OAuth (mirrors TechFunctN GET /auth/login)
    [HttpGet("login")]
    public async Task<IActionResult> RedirectToKite()
    {
        var loginUrl = await _kiteService.GetLoginUrlAsync();
        return Redirect(loginUrl);
    }

    // Kite OAuth callback — exchanges token, saves session, redirects to frontend (mirrors TechFunctN GET /auth/callback)
    [HttpGet("callback")]
    public async Task<IActionResult> HandleCallback([FromQuery] string? request_token, [FromQuery] string? status)
    {
        if (string.IsNullOrEmpty(request_token) || status != "success")
        {
            _logger.LogWarning("Kite callback missing request_token or status. status={Status}", status);
            return Redirect($"{_frontendUrl}/login?error=no_token");
        }

        try
        {
            await _kiteService.GenerateSessionAsync(request_token);
            _logger.LogInformation("Kite session created successfully via callback");
            return Redirect($"{_frontendUrl}/?auth=success");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kite callback session generation failed");
            return Redirect($"{_frontendUrl}/login?error=auth_failed");
        }
    }

    // Returns the Kite login URL (kept for direct API use)
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

    // Checks if an active Kite session exists (mirrors TechFunctN GET /auth/session)
    [HttpGet("session")]
    public async Task<IActionResult> GetSession()
    {
        var token = await _kiteService.GetActiveAccessTokenAsync();
        if (string.IsNullOrEmpty(token))
            return Ok(new { isAuthenticated = false });

        return Ok(new { isAuthenticated = true });
    }

    [HttpGet("validate")]
    public async Task<IActionResult> ValidateToken()
    {
        var token = await _kiteService.GetActiveAccessTokenAsync();
        if (string.IsNullOrEmpty(token))
            return Unauthorized(new { error = "No active token" });

        var isValid = await _kiteService.ValidateTokenAsync(token);
        return Ok(new { isValid });
    }

    // Invalidates the current session (mirrors TechFunctN POST /auth/logout)
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        try
        {
            await _kiteService.RefreshTokenAsync();
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Logout failed");
            return StatusCode(500, new { error = "Logout failed" });
        }
    }
}

public record SessionRequest(string RequestToken);
