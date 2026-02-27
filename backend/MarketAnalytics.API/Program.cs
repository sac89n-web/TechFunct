using MarketAnalytics.API.BackgroundServices;
using MarketAnalytics.API.Hubs;
using MarketAnalytics.Core.Interfaces;
using MarketAnalytics.Infrastructure.Cache;
using MarketAnalytics.Infrastructure.Services;

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
builder.Services.AddSingleton<IWebSocketService, WebSocketService>();

builder.Services.AddHostedService<TokenRefreshService>();
builder.Services.AddHostedService<MarketDataSyncService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();
app.MapHub<MarketDataHub>("/hubs/marketdata");

app.Run();
