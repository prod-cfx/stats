-- Roll out with the new semantic-state-only code path; do not apply ahead of older app instances.
ALTER TABLE "llm_strategy_codegen_sessions"
DROP COLUMN "checklist";
