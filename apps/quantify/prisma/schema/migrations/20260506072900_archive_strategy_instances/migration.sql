-- Archive user-visible strategy instances without deleting audit/history entities.
ALTER TABLE "strategy_instances"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "archived_reason" TEXT,
  ADD COLUMN "archived_by_user_id" TEXT;

CREATE INDEX "idx_strategy_instance_creator_archived_updated"
  ON "strategy_instances"("created_by", "archived_at", "updated_at");

DROP INDEX IF EXISTS "uniq_strategy_instance_template_model_name";

CREATE UNIQUE INDEX "uniq_strategy_instance_visible_template_model_name"
  ON "strategy_instances"("strategy_template_id", "llm_model", "name")
  WHERE "archived_at" IS NULL;

CREATE INDEX "idx_strategy_instance_template_model_name_archived"
  ON "strategy_instances"("strategy_template_id", "llm_model", "name", "archived_at");
