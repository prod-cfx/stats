-- add structured AI Quant snapshot and deployment truth fields
-- nullable columns keep historical rows readable during dual-read rollout

ALTER TABLE "published_strategy_snapshots"
ADD COLUMN "strategy_config" JSONB,
ADD COLUMN "backtest_config_defaults" JSONB,
ADD COLUMN "deployment_execution_defaults" JSONB,
ADD COLUMN "deployment_execution_constraints" JSONB;

ALTER TABLE "strategy_instances"
ADD COLUMN "deployment_execution_config" JSONB,
ADD COLUMN "execution_config_version" INTEGER NOT NULL DEFAULT 1;
