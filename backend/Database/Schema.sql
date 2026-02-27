-- Market Analytics Database Schema
-- SQL Server 2019+

USE master;
GO

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'MarketAnalytics')
BEGIN
    CREATE DATABASE MarketAnalytics;
END
GO

USE MarketAnalytics;
GO

-- Kite Session Management
CREATE TABLE KiteSession (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    AccessToken NVARCHAR(500) NOT NULL,
    PublicToken NVARCHAR(500),
    UserId NVARCHAR(100) NOT NULL,
    CreatedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ExpiryDate DATETIME2 NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_KiteSession_AccessToken UNIQUE (AccessToken)
);
GO

CREATE INDEX IX_KiteSession_IsActive_ExpiryDate ON KiteSession(IsActive, ExpiryDate);
GO

-- Instrument Master
CREATE TABLE InstrumentMaster (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    InstrumentToken BIGINT NOT NULL,
    TradingSymbol NVARCHAR(100) NOT NULL,
    Exchange NVARCHAR(10) NOT NULL,
    Segment NVARCHAR(20) NOT NULL,
    TickSize DECIMAL(10,4),
    LotSize INT,
    Sector NVARCHAR(100),
    IndexName NVARCHAR(50),
    IndexWeight DECIMAL(10,4),
    LastUpdated DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_InstrumentMaster_Token UNIQUE (InstrumentToken)
);
GO

CREATE INDEX IX_InstrumentMaster_Symbol ON InstrumentMaster(TradingSymbol, Exchange);
CREATE INDEX IX_InstrumentMaster_Index ON InstrumentMaster(IndexName) WHERE IndexName IS NOT NULL;
GO

-- Stock Price History
CREATE TABLE StockPriceHistory (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    InstrumentToken BIGINT NOT NULL,
    Symbol NVARCHAR(100) NOT NULL,
    TradeDate DATETIME2 NOT NULL,
    [Open] DECIMAL(18,4) NOT NULL,
    High DECIMAL(18,4) NOT NULL,
    Low DECIMAL(18,4) NOT NULL,
    [Close] DECIMAL(18,4) NOT NULL,
    Volume BIGINT NOT NULL,
    [Interval] NVARCHAR(20) NOT NULL,
    Source NVARCHAR(20) NOT NULL DEFAULT 'KITE',
    CreatedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_StockPriceHistory UNIQUE (InstrumentToken, TradeDate, [Interval])
);
GO

CREATE CLUSTERED INDEX IX_StockPriceHistory_Symbol_Date ON StockPriceHistory(Symbol, TradeDate DESC);
CREATE INDEX IX_StockPriceHistory_Token_Date ON StockPriceHistory(InstrumentToken, TradeDate DESC);
GO

-- Technical Indicators Cache
CREATE TABLE TechnicalIndicators (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    Symbol NVARCHAR(100) NOT NULL,
    InstrumentToken BIGINT NOT NULL,
    CalculationDate DATETIME2 NOT NULL,
    LTP DECIMAL(18,4),
    SMA20 DECIMAL(18,4),
    SMA50 DECIMAL(18,4),
    SMA200 DECIMAL(18,4),
    RSI14 DECIMAL(10,4),
    BBUpper DECIMAL(18,4),
    BBMiddle DECIMAL(18,4),
    BBLower DECIMAL(18,4),
    VolumeRatio DECIMAL(10,4),
    DistanceFromSMA20 DECIMAL(10,4),
    DistanceFromSMA50 DECIMAL(10,4),
    DistanceFromSMA200 DECIMAL(10,4),
    IsGoldenCross BIT,
    IsDeathCross BIT,
    LastUpdated DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_TechnicalIndicators UNIQUE (Symbol, CalculationDate)
);
GO

CREATE INDEX IX_TechnicalIndicators_Symbol ON TechnicalIndicators(Symbol, LastUpdated DESC);
GO

-- Market Snapshot
CREATE TABLE MarketSnapshot (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Symbol NVARCHAR(100) NOT NULL,
    InstrumentToken BIGINT NOT NULL,
    LTP DECIMAL(18,4) NOT NULL,
    ChangePercent DECIMAL(10,4) NOT NULL,
    Volume BIGINT NOT NULL,
    High DECIMAL(18,4),
    Low DECIMAL(18,4),
    [Open] DECIMAL(18,4),
    PreviousClose DECIMAL(18,4),
    Sector NVARCHAR(100),
    IndexName NVARCHAR(50),
    IndexWeight DECIMAL(10,4),
    LastUpdated DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_MarketSnapshot_Symbol UNIQUE (Symbol)
);
GO

CREATE INDEX IX_MarketSnapshot_Index ON MarketSnapshot(IndexName) WHERE IndexName IS NOT NULL;
GO

-- Momentum Scores
CREATE TABLE MomentumScores (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Symbol NVARCHAR(100) NOT NULL,
    InstrumentToken BIGINT NOT NULL,
    MomentumScore DECIMAL(10,4) NOT NULL,
    Signal NVARCHAR(50) NOT NULL,
    PriceAboveSMA20 BIT,
    PriceAboveSMA50 BIT,
    RSITrend NVARCHAR(20),
    VolumeSpike BIT,
    BreakoutProximity DECIMAL(10,4),
    SectorStrength DECIMAL(10,4),
    CalculationDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_MomentumScores UNIQUE (Symbol, CalculationDate)
);
GO

CREATE INDEX IX_MomentumScores_Score ON MomentumScores(MomentumScore DESC, CalculationDate DESC);
GO

-- Market Breadth
CREATE TABLE MarketBreadth (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IndexName NVARCHAR(50) NOT NULL,
    Advances INT NOT NULL,
    Declines INT NOT NULL,
    Unchanged INT NOT NULL,
    AdvanceDeclineRatio DECIMAL(10,4),
    CalculationDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_MarketBreadth UNIQUE (IndexName, CalculationDate)
);
GO

-- Application Logs
CREATE TABLE ApplicationLogs (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    LogLevel NVARCHAR(20) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    Exception NVARCHAR(MAX),
    Source NVARCHAR(200),
    CreatedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IX_ApplicationLogs_Date ON ApplicationLogs(CreatedDate DESC);
GO
