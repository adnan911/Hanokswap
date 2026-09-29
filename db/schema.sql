-- ============================================================================
-- TimescaleDB & PostgreSQL Production Schema for Giwa DEX
-- Optimized for Giwa Chain's 200ms Flashblocks & High-Throughput Aggregations
-- ============================================================================

-- Ensure TimescaleDB extension is enabled
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 1. Pools Registry Table
CREATE TABLE IF NOT EXISTS pools (
    address VARCHAR(42) PRIMARY KEY,
    token0_address VARCHAR(42) NOT NULL,
    token1_address VARCHAR(42) NOT NULL,
    token0_symbol VARCHAR(20) NOT NULL,
    token1_symbol VARCHAR(20) NOT NULL,
    token0_decimals INT NOT NULL,
    token1_decimals INT NOT NULL,
    pool_type VARCHAR(10) NOT NULL CHECK (pool_type IN ('CLAMM', 'STABLE')),
    fee_tier INT NOT NULL,
    tick_spacing INT NOT NULL,
    total_value_locked_usd NUMERIC(28, 8) DEFAULT 0,
    volume_24h_usd NUMERIC(28, 8) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    block_number_created BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pools_tokens ON pools(token0_address, token1_address);
CREATE INDEX IF NOT EXISTS idx_pools_type ON pools(pool_type);

-- 2. Real-Time Swaps Hypertable (Streaming from Envio / Flashblocks Indexer)
CREATE TABLE IF NOT EXISTS pool_swaps (
    id BIGSERIAL,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    pool_address VARCHAR(42) NOT NULL REFERENCES pools(address),
    sender VARCHAR(42) NOT NULL,
    recipient VARCHAR(42) NOT NULL,
    amount0 NUMERIC(78, 0) NOT NULL,
    amount1 NUMERIC(78, 0) NOT NULL,
    sqrt_price_x96 NUMERIC(78, 0) NOT NULL,
    liquidity NUMERIC(78, 0) NOT NULL,
    tick INT NOT NULL,
    amount_usd NUMERIC(28, 8) DEFAULT 0,
    is_flashblock_pending BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (id, block_timestamp)
);

-- Convert pool_swaps into TimescaleDB hypertable partitioned by timestamp (1-day chunks)
SELECT create_hypertable('pool_swaps', 'block_timestamp', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day');

CREATE INDEX IF NOT EXISTS idx_swaps_pool_time ON pool_swaps(pool_address, block_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_swaps_tx ON pool_swaps(tx_hash);

-- 3. Liquidity Mints & Burns Table
CREATE TABLE IF NOT EXISTS pool_liquidity_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('MINT', 'BURN')),
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    pool_address VARCHAR(42) NOT NULL REFERENCES pools(address),
    provider_address VARCHAR(42) NOT NULL,
    tick_lower INT,
    tick_upper INT,
    liquidity_amount NUMERIC(78, 0) NOT NULL,
    amount0 NUMERIC(78, 0) NOT NULL,
    amount1 NUMERIC(78, 0) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_liq_pool_provider ON pool_liquidity_events(pool_address, provider_address);

-- 4. 1-Minute Continuous Aggregate for OHLCV Candlestick Charting
CREATE MATERIALIZED VIEW IF NOT EXISTS ohlcv_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', block_timestamp) AS bucket,
    pool_address,
    FIRST(sqrt_price_x96, block_timestamp) AS open_sqrt_price,
    MAX(sqrt_price_x96) AS high_sqrt_price,
    MIN(sqrt_price_x96) AS low_sqrt_price,
    LAST(sqrt_price_x96, block_timestamp) AS close_sqrt_price,
    SUM(amount_usd) AS volume_usd,
    COUNT(*) AS trade_count
FROM pool_swaps
WHERE is_flashblock_pending = FALSE
GROUP BY bucket, pool_address
WITH NO DATA;

-- Enable continuous aggregate refresh policy (every 1 minute)
SELECT add_continuous_aggregate_policy('ohlcv_1m',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE
);
