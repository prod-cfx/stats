-- Phase 5 S7 follow-up (#1058) caller R3 决策 A_new：
-- drawdownPct / peakEquity / lastDrawdownRecalcAt 字段从 llm_strategy_instances 迁到 strategy_instances
-- 原因：signal-generator 消费的是 strategy_instances（per-user single tenant），与 llm_strategy_instances 无 schema bridge

-- AlterTable: 撤销 llm_strategy_instances 的 3 列（之前 migration 20260509163607_add_drawdown_tracking 添加）
ALTER TABLE "llm_strategy_instances" DROP COLUMN IF EXISTS "drawdown_pct";
ALTER TABLE "llm_strategy_instances" DROP COLUMN IF EXISTS "last_drawdown_recalc_at";

-- AlterTable: 在 strategy_instances 上加 3 列
ALTER TABLE "strategy_instances" ADD COLUMN     "drawdown_pct" DOUBLE PRECISION;
ALTER TABLE "strategy_instances" ADD COLUMN     "peak_equity" DECIMAL(48,18);
ALTER TABLE "strategy_instances" ADD COLUMN     "last_drawdown_recalc_at" TIMESTAMP(3);

-- ROLLBACK reference (DO NOT execute unless reverting):
-- ALTER TABLE "strategy_instances" DROP COLUMN "drawdown_pct";
-- ALTER TABLE "strategy_instances" DROP COLUMN "peak_equity";
-- ALTER TABLE "strategy_instances" DROP COLUMN "last_drawdown_recalc_at";
-- ALTER TABLE "llm_strategy_instances" ADD COLUMN "drawdown_pct" DOUBLE PRECISION;
-- ALTER TABLE "llm_strategy_instances" ADD COLUMN "last_drawdown_recalc_at" TIMESTAMP(3);

-- 注：UserStrategyAccount.peak_equity 不变（per-user 真实 equity，仍由 applyLedgerDelta 维护）
