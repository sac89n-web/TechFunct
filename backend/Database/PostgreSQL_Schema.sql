-- Market Analytics PostgreSQL Schema

CREATE DATABASE marketanalytics;

\c marketanalytics;

CREATE TABLE kite_session (
    id SERIAL PRIMARY KEY,
    access_token VARCHAR(500) NOT NULL UNIQUE,
    public_token VARCHAR(500),
    user_id VARCHAR(100) NOT NULL,
    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    expiry_date TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_kite_session_active ON kite_session(is_active, expiry_date);

CREATE TABLE instrument_master (
    id SERIAL PRIMARY KEY,
    instrument_token BIGINT NOT NULL UNIQUE,
    trading_symbol VARCHAR(100) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    segment VARCHAR(20) NOT NULL,
    tick_size DECIMAL(10,4),
    lot_size INT,
    sector VARCHAR(100),
    index_name VARCHAR(50),
    index_weight DECIMAL(10,4),
    last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instrument_symbol ON instrument_master(trading_symbol, exchange);
CREATE INDEX idx_instrument_index ON instrument_master(index_name) WHERE index_name IS NOT NULL;

CREATE TABLE stock_price_history (
    id BIGSERIAL PRIMARY KEY,
    instrument_token BIGINT NOT NULL,
    symbol VARCHAR(100) NOT NULL,
    trade_date TIMESTAMP NOT NULL,
    open DECIMAL(18,4) NOT NULL,
    high DECIMAL(18,4) NOT NULL,
    low DECIMAL(18,4) NOT NULL,
    close DECIMAL(18,4) NOT NULL,
    volume BIGINT NOT NULL,
    interval VARCHAR(20) NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'KITE',
    created_date TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(instrument_token, trade_date, interval)
);

CREATE INDEX idx_stock_price_symbol ON stock_price_history(symbol, trade_date DESC);
CREATE INDEX idx_stock_price_token ON stock_price_history(instrument_token, trade_date DESC);

CREATE TABLE technical_indicators (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(100) NOT NULL,
    instrument_token BIGINT NOT NULL,
    calculation_date TIMESTAMP NOT NULL,
    ltp DECIMAL(18,4),
    sma20 DECIMAL(18,4),
    sma50 DECIMAL(18,4),
    sma200 DECIMAL(18,4),
    rsi14 DECIMAL(10,4),
    bb_upper DECIMAL(18,4),
    bb_middle DECIMAL(18,4),
    bb_lower DECIMAL(18,4),
    volume_ratio DECIMAL(10,4),
    distance_from_sma20 DECIMAL(10,4),
    distance_from_sma50 DECIMAL(10,4),
    distance_from_sma200 DECIMAL(10,4),
    is_golden_cross BOOLEAN,
    is_death_cross BOOLEAN,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(symbol, calculation_date)
);

CREATE INDEX idx_technical_indicators ON technical_indicators(symbol, last_updated DESC);

CREATE TABLE market_snapshot (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(100) NOT NULL UNIQUE,
    instrument_token BIGINT NOT NULL,
    ltp DECIMAL(18,4) NOT NULL,
    change_percent DECIMAL(10,4) NOT NULL,
    volume BIGINT NOT NULL,
    high DECIMAL(18,4),
    low DECIMAL(18,4),
    open DECIMAL(18,4),
    previous_close DECIMAL(18,4),
    sector VARCHAR(100),
    index_name VARCHAR(50),
    index_weight DECIMAL(10,4),
    last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_snapshot_index ON market_snapshot(index_name) WHERE index_name IS NOT NULL;

CREATE TABLE momentum_scores (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(100) NOT NULL,
    instrument_token BIGINT NOT NULL,
    momentum_score DECIMAL(10,4) NOT NULL,
    signal VARCHAR(50) NOT NULL,
    price_above_sma20 BOOLEAN,
    price_above_sma50 BOOLEAN,
    rsi_trend VARCHAR(20),
    volume_spike BOOLEAN,
    breakout_proximity DECIMAL(10,4),
    sector_strength DECIMAL(10,4),
    calculation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(symbol, calculation_date)
);

CREATE INDEX idx_momentum_scores ON momentum_scores(momentum_score DESC, calculation_date DESC);

CREATE TABLE market_breadth (
    id SERIAL PRIMARY KEY,
    index_name VARCHAR(50) NOT NULL,
    advances INT NOT NULL,
    declines INT NOT NULL,
    unchanged INT NOT NULL,
    advance_decline_ratio DECIMAL(10,4),
    calculation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(index_name, calculation_date)
);

CREATE TABLE application_logs (
    id BIGSERIAL PRIMARY KEY,
    log_level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    exception TEXT,
    source VARCHAR(200),
    created_date TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_application_logs ON application_logs(created_date DESC);
