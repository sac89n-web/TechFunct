using System;
using System.Threading;
using System.Threading.Tasks;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Hosting;

namespace MarketAnalytics.API.BackgroundServices;

public class TokenRefreshService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TokenRefreshService> _logger;

    public TokenRefreshService(IServiceProvider serviceProvider, ILogger<TokenRefreshService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = DateTime.UtcNow;
                var nextRun = now.Date.AddDays(1).AddHours(3);
                var delay = nextRun - now;

                if (delay.TotalMilliseconds > 0)
                {
                    _logger.LogInformation("Token refresh scheduled for {NextRun}", nextRun);
                    await Task.Delay(delay, stoppingToken);
                }

                using var scope = _serviceProvider.CreateScope();
                var kiteService = scope.ServiceProvider.GetRequiredService<IKiteConnectService>();
                
                await kiteService.RefreshTokenAsync();
                _logger.LogInformation("Token refresh completed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Token refresh failed");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
