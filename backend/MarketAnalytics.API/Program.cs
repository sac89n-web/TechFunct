using Dapper;
using MarketAnalytics.API.BackgroundServices;
using MarketAnalytics.API.Hubs;
using MarketAnalytics.Core.Interfaces;
using MarketAnalytics.Infrastructure.Cache;
using MarketAnalytics.Infrastructure.Services;

DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

builder.Services.AddHttpClient();

builder.Services.AddSingleton<IMarketDataCache, MarketDataCache>();
builder.Services.AddScoped<IKiteConnectService, KiteConnectService>();
builder.Services.AddScoped<IInstrumentService, InstrumentService>();
builder.Services.AddScoped<IHistoricalDataService, HistoricalDataService>();
builder.Services.AddScoped<IIndicatorEngine, IndicatorEngine>();
builder.Services.AddScoped<IMarketAnalyticsService, MarketAnalyticsService>();
builder.Services.AddScoped<IStrategyService, StrategyService>();
builder.Services.AddSingleton<IWebSocketService, WebSocketService>();

// Options Engine services
builder.Services.AddSingleton<IGreeksCalculator, GreeksCalculator>();
builder.Services.AddScoped<IOptionsChainService, OptionsChainService>();
builder.Services.AddScoped<IOptionStrategyEngine, OptionStrategyEngine>();

builder.Services.AddHostedService<TokenRefreshService>();
builder.Services.AddHostedService<MarketDataSyncService>();

builder.Services.AddCors(options =>
{
    // allow origins from configuration (semicolon-separated) or default to localhost
    var origins = builder.Configuration.GetValue<string>("AllowedOrigins");
    string[] allowed = string.IsNullOrEmpty(origins)
        ? new[] { "http://127.0.0.1:3000" }
        : origins.Split(';', StringSplitOptions.RemoveEmptyEntries);

    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins(allowed)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Handle Render's PORT environment variable
var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Urls.Add($"http://0.0.0.0:{port}");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();
app.MapHub<MarketDataHub>("/hubs/marketdata");
app.MapHub<OptionsHub>("/hubs/options");

app.Run();
