-- AlterTable
ALTER TABLE "user_strategy_accounts" ADD COLUMN     "peak_equity" DECIMAL(48,18);

-- AlterTable
ALTER TABLE "llm_strategy_instances" ADD COLUMN     "drawdown_pct" DOUBLE PRECISION,
ADD COLUMN     "last_drawdown_recalc_at" TIMESTAMP(3);

-- ROLLBACK reference (DO NOT execute unless reverting):
-- ALTER TABLE "user_strategy_accounts" DROP COLUMN "peak_equity";
-- ALTER TABLE "llm_strategy_instances" DROP COLUMN "drawdown_pct";
-- ALTER TABLE "llm_strategy_instances" DROP COLUMN "last_drawdown_recalc_at";
