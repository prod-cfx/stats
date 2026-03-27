ALTER TABLE "llm_strategy_codegen_sessions"
ADD COLUMN IF NOT EXISTS "strategy_instance_id" TEXT;
