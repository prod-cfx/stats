-- Add unique constraint on (symbol, venue, instrument_type)
CREATE UNIQUE INDEX "unique_market_config" ON "orderbook_pair_configs"("symbol", "venue", "instrument_type");

-- Add index on instrument_type for better query performance
CREATE INDEX "orderbook_pair_configs_instrument_type_idx" ON "orderbook_pair_configs"("instrument_type");
