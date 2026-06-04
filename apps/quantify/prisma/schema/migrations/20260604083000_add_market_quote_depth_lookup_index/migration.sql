CREATE INDEX IF NOT EXISTS "idx_market_quotes_depth_symbol_event_time"
ON "public"."market_quotes" ("symbol_id", "event_time" DESC)
WHERE "bid_price" IS NOT NULL
  AND "bid_qty" IS NOT NULL
  AND "ask_price" IS NOT NULL
  AND "ask_qty" IS NOT NULL;
