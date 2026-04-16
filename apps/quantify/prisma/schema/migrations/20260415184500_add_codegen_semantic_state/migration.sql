ALTER TABLE "llm_strategy_codegen_sessions"
ADD COLUMN IF NOT EXISTS "semantic_state" JSONB;
