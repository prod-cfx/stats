-- WARNING: For production with existing data, run this manually with CONCURRENTLY:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_whale_alert_user_address" 
--   ON "hyperliquid_whale_alerts" ("user_address");
-- Then comment out the line below before deployment.

CREATE INDEX IF NOT EXISTS "idx_whale_alert_user_address" ON "hyperliquid_whale_alerts" ("user_address");
