using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Entities;

namespace MarketAnalytics.Core.Interfaces;

public interface IKiteConnectService
{
    Task<string> GetLoginUrlAsync();
    Task<KiteAuthResponseDto> GenerateSessionAsync(string requestToken);
    Task<string?> GetActiveAccessTokenAsync();
    Task<bool> ValidateTokenAsync(string accessToken);
    Task RefreshTokenAsync();
}

public interface IInstrumentService
{
    Task SyncInstrumentsAsync();
    Task<InstrumentMaster?> GetInstrumentBySymbolAsync(string symbol, string exchange = "NSE");
    Task<List<InstrumentMaster>> GetIndexConstituentsAsync(string indexName);
}

public interface IHistoricalDataService
{
    Task SyncHistoricalDataAsync(long instrumentToken, string symbol, string interval, DateTime from, DateTime to);
    Task<List<StockPriceHistory>> GetHistoricalDataAsync(string symbol, string interval, int days);
}

public interface IIndicatorEngine
{
    Task CalculateIndicatorsAsync(string symbol);
    Task BatchCalculateIndicatorsAsync(List<string> symbols);
    Task<TechnicalIndicators?> GetLatestIndicatorsAsync(string symbol);
}

public interface IMarketAnalyticsService
{
    Task<List<HeatmapItemDto>> GetHeatmapAsync(string indexName);
    Task<List<MomentumItemDto>> GetMomentumScannerAsync(string indexName);
    Task<StockAnalysisDto?> GetStockAnalysisAsync(string symbol);
    Task<MarketBreadthDto?> GetMarketBreadthAsync(string indexName);
}

public interface IWebSocketService
{
    Task ConnectAsync(string accessToken);
    Task SubscribeAsync(List<long> instrumentTokens);
    Task DisconnectAsync();
    event EventHandler<KiteTickDto>? OnTickReceived;
}

public interface IMarketDataCache
{
    void UpdateSnapshot(string symbol, KiteTickDto tick);
    MarketSnapshot? GetSnapshot(string symbol);
    Dictionary<string, MarketSnapshot> GetAllSnapshots();
    void Clear();
}
