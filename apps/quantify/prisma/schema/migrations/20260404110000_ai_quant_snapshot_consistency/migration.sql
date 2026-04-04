-- persist ai quant snapshot contract extensions for summary/locked params/version

ALTER TABLE "published_strategy_snapshots"
ADD COLUMN "user_intent_summary" JSONB DEFAULT '{}'::jsonb,
ADD COLUMN "strategy_summary" JSONB DEFAULT '{}'::jsonb,
ADD COLUMN "script_summary" JSONB DEFAULT '{}'::jsonb,
ADD COLUMN "locked_params" JSONB DEFAULT '{}'::jsonb,
ADD COLUMN "snapshot_version" INTEGER NOT NULL DEFAULT 2;

UPDATE "published_strategy_snapshots"
SET
  "user_intent_summary" = COALESCE("user_intent_summary", '{}'::jsonb),
  "strategy_summary" = COALESCE("strategy_summary", '{}'::jsonb),
  "script_summary" = COALESCE("script_summary", '{}'::jsonb),
  "locked_params" = COALESCE("locked_params", '{}'::jsonb);

ALTER TABLE "published_strategy_snapshots"
ALTER COLUMN "user_intent_summary" SET NOT NULL,
ALTER COLUMN "strategy_summary" SET NOT NULL,
ALTER COLUMN "script_summary" SET NOT NULL,
ALTER COLUMN "locked_params" SET NOT NULL;
