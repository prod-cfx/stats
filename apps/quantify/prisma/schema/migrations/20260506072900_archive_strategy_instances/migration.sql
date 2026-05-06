-- Archive user-visible strategy instances without deleting audit/history entities.
ALTER TABLE "strategy_instances"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "archived_reason" TEXT,
  ADD COLUMN "archived_by_user_id" TEXT;

CREATE INDEX "idx_strategy_instance_creator_archived_updated"
  ON "strategy_instances"("created_by", "archived_at", "updated_at");
