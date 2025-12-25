-- Ensure existing rows have a concrete exchange code
UPDATE "aggregated_liquidation_history"
SET "exchange_code" = 'AGGREGATED'
WHERE "exchange_code" IS NULL;

-- Set default value and enforce NOT NULL
ALTER TABLE "aggregated_liquidation_history"
ALTER COLUMN "exchange_code" SET DEFAULT 'AGGREGATED';

ALTER TABLE "aggregated_liquidation_history"
ALTER COLUMN "exchange_code" SET NOT NULL;

