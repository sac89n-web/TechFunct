using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dapper;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Entities;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Npgsql;
using System.Security.Cryptography;
using System.Text;

namespace MarketAnalytics.Infrastructure.Services;

public class KiteConnectService : IKiteConnectService
{
    private readonly IConfiguration _config;
    private readonly ILogger<KiteConnectService> _logger;
    private readonly string _connectionString;
    private readonly string _apiKey;
    private readonly string _apiSecret;
    private readonly HttpClient _httpClient;

    public KiteConnectService(IConfiguration config, ILogger<KiteConnectService> logger, IHttpClientFactory httpClientFactory)
    {
        _config = config;
        _logger = logger;
        _connectionString = config.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException("Connection string not found");
        _apiKey = config["Kite:ApiKey"] ?? throw new InvalidOperationException("Kite API Key not found");
        _apiSecret = config["Kite:ApiSecret"] ?? throw new InvalidOperationException("Kite API Secret not found");
        _httpClient = httpClientFactory.CreateClient();
    }

    public Task<string> GetLoginUrlAsync()
    {
        var loginUrl = $"https://kite.zerodha.com/connect/login?v=3&api_key={_apiKey}";
        return Task.FromResult(loginUrl);
    }

    public async Task<KiteAuthResponseDto> GenerateSessionAsync(string requestToken)
    {
        var checksum = GenerateChecksum(_apiKey, requestToken, _apiSecret);
        
        var payload = new Dictionary<string, string>
        {
            { "api_key", _apiKey },
            { "request_token", requestToken },
            { "checksum", checksum }
        };

        var content = new FormUrlEncodedContent(payload);
        var response = await _httpClient.PostAsync("https://api.kite.trade/session/token", content);
        
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("Kite session generation failed: {Error}", error);
            throw new Exception($"Failed to generate session: {error}");
        }

        var jsonResponse = await response.Content.ReadAsStringAsync();
        var result = JsonConvert.DeserializeObject<dynamic>(jsonResponse);
        
        var authResponse = new KiteAuthResponseDto
        {
            AccessToken = result?.data?.access_token ?? throw new Exception("Access token not found"),
            PublicToken = result?.data?.public_token ?? "",
            UserId = result?.data?.user_id ?? ""
        };

        await SaveSessionAsync(authResponse);
        
        return authResponse;
    }

    public async Task<string?> GetActiveAccessTokenAsync()
    {
        using var connection = new NpgsqlConnection(_connectionString);
        var session = await connection.QueryFirstOrDefaultAsync<KiteSession>(
            "SELECT * FROM kite_session WHERE is_active = TRUE AND expiry_date > NOW() ORDER BY created_date DESC LIMIT 1"
        );
        
        return session?.AccessToken;
    }

    public async Task<bool> ValidateTokenAsync(string accessToken)
    {
        try
        {
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("X-Kite-Version", "3");
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"token {_apiKey}:{accessToken}");
            
            var response = await _httpClient.GetAsync("https://api.kite.trade/user/profile");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public async Task RefreshTokenAsync()
    {
        using var connection = new NpgsqlConnection(_connectionString);
        await connection.ExecuteAsync("UPDATE kite_session SET is_active = FALSE WHERE is_active = TRUE");
        _logger.LogInformation("Token refresh required - user must re-authenticate");
    }

    private async Task SaveSessionAsync(KiteAuthResponseDto authResponse)
    {
        using var connection = new NpgsqlConnection(_connectionString);
        
        await connection.ExecuteAsync("UPDATE kite_session SET is_active = FALSE WHERE is_active = TRUE");
        
        var expiryDate = DateTime.UtcNow.Date.AddDays(1).AddHours(3).AddMinutes(30);
        
        await connection.ExecuteAsync(
            @"INSERT INTO kite_session (access_token, public_token, user_id, created_date, expiry_date, is_active)
              VALUES (@AccessToken, @PublicToken, @UserId, @CreatedDate, @ExpiryDate, TRUE)",
            new
            {
                authResponse.AccessToken,
                authResponse.PublicToken,
                authResponse.UserId,
                CreatedDate = DateTime.UtcNow,
                ExpiryDate = expiryDate
            }
        );
        
        _logger.LogInformation("Kite session saved for user: {UserId}", authResponse.UserId);
    }

    private static string GenerateChecksum(string apiKey, string requestToken, string apiSecret)
    {
        var data = $"{apiKey}{requestToken}{apiSecret}";
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(data));
        return BitConverter.ToString(hash).Replace("-", "").ToLower();
    }
}
