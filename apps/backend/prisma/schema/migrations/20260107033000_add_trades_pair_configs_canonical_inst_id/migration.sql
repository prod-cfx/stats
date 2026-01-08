-- Add canonical instId column for trades configs
ALTER TABLE "trades_pair_configs"
ADD COLUMN "canonical_inst_id" TEXT;

-- Backfill canonical instId for existing rows
UPDATE "trades_pair_configs"
SET "canonical_inst_id" = COALESCE(
  NULLIF(UPPER(("metadata"->>'okxInstId')), ''),
  NULLIF(UPPER(("metadata"->>'instId')), ''),
  NULLIF(UPPER(("metadata"->>'symbol')), ''),
  CASE
    WHEN POSITION('-' IN "symbol") > 0 THEN UPPER("symbol")
    WHEN "instrument_type" = 'SPOT' THEN UPPER("base_asset") || '-' || UPPER("quote_asset")
    WHEN "instrument_type" = 'PERPETUAL' THEN UPPER("base_asset") || '-' || UPPER("quote_asset") || '-SWAP'
    WHEN "instrument_type" = 'FUTURE' THEN NULLIF(UPPER(("metadata"->>'okxContract')), '')
    ELSE NULL
  END
)
WHERE "canonical_inst_id" IS NULL;

-- Ensure canonical instId is unique per exchange + instrument type
CREATE UNIQUE INDEX "trades_pair_configs_canonical_inst_id_key"
ON "trades_pair_configs"("exchange", "instrument_type", "canonical_inst_id");

