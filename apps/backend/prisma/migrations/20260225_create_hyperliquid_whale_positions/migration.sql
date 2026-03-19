-- CreateTable: hyperliquid_whale_positions
-- This table stores Hyperliquid whale position snapshots (positions > $1M USD)
-- Design: upsert mode - same user+symbol position gets updated, not appended

CREATE TABLE IF NOT EXISTS "hyperliquid_whale_positions" (
    "id" SERIAL NOT NULL,
    "user_address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "position_size" DECIMAL(30,10) NOT NULL,
    "entry_price" DECIMAL(30,10) NOT NULL,
    "liquidation_price" DECIMAL(30,10),
    "position_value_usd" DECIMAL(30,10) NOT NULL,
    "pnl" DECIMAL(30,10),
    "roe" DECIMAL(18,8),
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "snapshot_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hyperliquid_whale_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_whale_position_user_symbol" ON "hyperliquid_whale_positions"("user_address", "symbol");

-- CreateIndex: query optimization indexes
CREATE INDEX IF NOT EXISTS "idx_whale_position_user_address" ON "hyperliquid_whale_positions"("user_address");
CREATE INDEX IF NOT EXISTS "idx_whale_position_symbol" ON "hyperliquid_whale_positions"("symbol");
CREATE INDEX IF NOT EXISTS "idx_whale_position_value" ON "hyperliquid_whale_positions"("position_value_usd");
CREATE INDEX IF NOT EXISTS "idx_whale_position_snapshot_time" ON "hyperliquid_whale_positions"("snapshot_time");

-- CreateIndex: composite index for common query pattern (filter by symbol, order by value DESC)
-- WARNING: For production with existing large data, run this manually with CONCURRENTLY:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_whale_position_symbol_value_desc"
--   ON "hyperliquid_whale_positions" ("symbol", "position_value_usd" DESC);
CREATE INDEX IF NOT EXISTS "idx_whale_position_symbol_value_desc" ON "hyperliquid_whale_positions" ("symbol", "position_value_usd" DESC);
