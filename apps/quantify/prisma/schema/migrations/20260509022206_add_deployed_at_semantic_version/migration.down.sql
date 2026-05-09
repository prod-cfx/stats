-- Rollback for 20260509022206_add_deployed_at_semantic_version
-- 删除 atom 翻牌版本追踪字段；回滚后所有 instance 视为 legacy（fail-closed 旧行为）

ALTER TABLE "llm_strategy_instances" DROP COLUMN IF EXISTS "deployed_at_semantic_version";
