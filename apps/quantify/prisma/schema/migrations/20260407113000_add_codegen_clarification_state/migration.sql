-- persist clarification gate state for multi-turn codegen sessions
-- nullable column keeps historical rows backward compatible

ALTER TABLE "llm_strategy_codegen_sessions"
ADD COLUMN "clarification_state" JSONB;
