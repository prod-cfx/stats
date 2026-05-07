-- Align the strategy_instances partial unique index with the runnable visibility helper.
-- Previously the index only excluded archived rows, so a view-only OLD instance still
-- claimed (strategy_template_id, llm_model, name) and made plaza re-run hit a
-- UniqueConstraintViolation when the new instance's name was finalized during deploy.
-- View-only = retired by the user; it should not participate in name uniqueness.

DROP INDEX IF EXISTS "uniq_strategy_instance_visible_template_model_name";

CREATE UNIQUE INDEX "uniq_strategy_instance_runnable_template_model_name"
  ON "strategy_instances"("strategy_template_id", "llm_model", "name")
  WHERE "archived_at" IS NULL AND "view_only_at" IS NULL;
