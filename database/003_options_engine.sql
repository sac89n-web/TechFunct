-- ============================================================
-- Migration 003: Options Engine
-- Run once against marketanalytics database
-- ============================================================

-- Step 1: Extend instrument_master with options columns
ALTER TABLE instrument_master
    ADD COLUMN IF NOT EXISTS name             VARCHAR(50),
    ADD COLUMN IF NOT EXISTS expiry           DATE,
    ADD COLUMN IF NOT EXISTS strike           DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS instrument_type  VARCHAR(10);

-- Add unique constraint for upsert support (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'uq_instrument_symbol_exchange'
          AND table_name = 'instrument_master'
    ) THEN
        -- Remove duplicates first (keep highest id)
        DELETE FROM instrument_master a USING instrument_master b
        WHERE a.id < b.id
          AND a.trading_symbol = b.trading_symbol
          AND a.exchange = b.exchange;

        ALTER TABLE instrument_master
            ADD CONSTRAINT uq_instrument_symbol_exchange
            UNIQUE (trading_symbol, exchange);
    END IF;
END $$;

-- Step 2: Option chain cache (refreshed every 30s during market hours)
CREATE TABLE IF NOT EXISTS option_chain_cache (
    id                BIGSERIAL PRIMARY KEY,
    index_name        VARCHAR(20)    NOT NULL,
    expiry_date       DATE           NOT NULL,
    strike            DECIMAL(10,2)  NOT NULL,
    instrument_token  BIGINT         NOT NULL,
    trading_symbol    VARCHAR(30)    NOT NULL,
    option_type       CHAR(2)        NOT NULL,
    ltp               DECIMAL(10,2)  NOT NULL DEFAULT 0,
    bid               DECIMAL(10,2)  NOT NULL DEFAULT 0,
    ask               DECIMAL(10,2)  NOT NULL DEFAULT 0,
    oi                BIGINT         NOT NULL DEFAULT 0,
    oi_change         BIGINT         NOT NULL DEFAULT 0,
    volume            BIGINT         NOT NULL DEFAULT 0,
    iv                DECIMAL(8,4),
    delta_val         DECIMAL(10,6),
    gamma_val         DECIMAL(12,8),
    theta_val         DECIMAL(10,6),
    vega_val          DECIMAL(10,6),
    lot_size          INT            NOT NULL DEFAULT 0,
    last_updated      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE(index_name, expiry_date, strike, option_type)
);

CREATE INDEX IF NOT EXISTS idx_occ_index_expiry
    ON option_chain_cache(index_name, expiry_date);
CREATE INDEX IF NOT EXISTS idx_occ_strike
    ON option_chain_cache(strike, option_type);

-- Step 3: IV history for percentile calculation
CREATE TABLE IF NOT EXISTS option_iv_history (
    id            BIGSERIAL PRIMARY KEY,
    index_name    VARCHAR(20)   NOT NULL,
    trade_date    DATE          NOT NULL,
    atm_iv        DECIMAL(8,4)  NOT NULL,
    iv_percentile DECIMAL(5,2),
    UNIQUE(index_name, trade_date)
);

-- Step 4: Generated strategy snapshots
CREATE TABLE IF NOT EXISTS option_strategy_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    strategy_id     UUID          NOT NULL DEFAULT gen_random_uuid(),
    index_name      VARCHAR(20)   NOT NULL,
    expiry_date     DATE          NOT NULL,
    strategy_name   VARCHAR(60)   NOT NULL,
    strategy_type   VARCHAR(30)   NOT NULL,
    bias            VARCHAR(30)   NOT NULL,
    confidence      DECIMAL(5,2)  NOT NULL,
    total_score     DECIMAL(6,2)  NOT NULL,
    rank            INT           NOT NULL,
    legs_json       JSONB         NOT NULL DEFAULT '[]',
    greeks_json     JSONB         NOT NULL DEFAULT '{}',
    metrics_json    JSONB         NOT NULL DEFAULT '{}',
    factor_scores   JSONB         NOT NULL DEFAULT '{}',
    generated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oss_index_generated
    ON option_strategy_snapshots(index_name, generated_at DESC);
