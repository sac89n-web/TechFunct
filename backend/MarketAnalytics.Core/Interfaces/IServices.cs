using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Entities;

// OptionsDtos types used by options interfaces

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
    Task SyncOptionInstrumentsAsync();
    Task<InstrumentMaster?> GetInstrumentBySymbolAsync(string symbol, string exchange = "NSE");
    Task<List<InstrumentMaster>> GetIndexConstituentsAsync(string indexName);
    Task<List<string>> GetIndexSymbolsAsync(string indexName);
    Task<List<InstrumentMaster>> GetInstrumentsBySymbolsAsync(IEnumerable<string> symbols);
    Task SeedMarketSnapshotAsync(IEnumerable<InstrumentMaster> instruments);
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
    Task CalculateMomentumScoresAsync(List<string> symbols);
}

public interface IMarketAnalyticsService
{
    Task<List<HeatmapItemDto>> GetHeatmapAsync(string indexName);
    Task<List<MomentumItemDto>> GetMomentumScannerAsync(string indexName);
    Task<StockAnalysisDto?> GetStockAnalysisAsync(string symbol);
    Task<List<StockAnalysisDto>> GetIndexAnalysisAsync(string indexName);
    Task<MarketBreadthDto?> GetMarketBreadthAsync(string indexName);
    Task<List<IndexQuoteDto>> GetIndexQuotesAsync();
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

public interface IStrategyService
{
    Task<List<StrategyRankingDto>> GetTop10StrategiesAsync(string indexName = "NIFTY50");
}

public interface IGreeksCalculator
{
    double CallPrice(double S, double K, double T, double r, double sigma);
    double PutPrice(double S, double K, double T, double r, double sigma);
    double Delta(double S, double K, double T, double r, double sigma, bool isCall);
    double Gamma(double S, double K, double T, double r, double sigma);
    double Theta(double S, double K, double T, double r, double sigma, bool isCall);
    double Vega(double S, double K, double T, double r, double sigma);
    double? ImpliedVolatility(double marketPrice, double S, double K, double T, double r, bool isCall);
}

public interface IOptionsChainService
{
    Task<OptionChainResultDto> GetOptionChainAsync(string indexName, DateOnly expiry);
    Task<List<DateOnly>> GetExpiriesAsync(string indexName);
    Task<decimal> GetUnderlyingLtpAsync(string indexName);
}

public interface IOptionStrategyEngine
{
    Task<List<OptionStrategyDto>> GetTopStrategiesAsync(OptionStrategyRequestDto request);
    Task<OptionStrategyDto?> GetStrategyByIdAsync(Guid strategyId);
}
