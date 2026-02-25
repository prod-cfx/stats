-- Add composite index for whale position queries
-- This index optimizes the common query pattern: filter by symbol, order by positionValueUsd DESC

-- WARNING: For production with existing data, run this manually with CONCURRENTLY:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_whale_position_symbol_value_desc"
--   ON "hyperliquid_whale_positions" ("symbol", "position_value_usd" DESC);
-- Then comment out the line below before deployment.

CREATE INDEX IF NOT EXISTS "idx_whale_position_symbol_value_desc" ON "hyperliquid_whale_positions" ("symbol", "position_value_usd" DESC);
