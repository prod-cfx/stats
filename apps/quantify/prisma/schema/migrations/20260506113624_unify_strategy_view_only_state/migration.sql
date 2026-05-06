-- AlterTable
ALTER TABLE "outbox_message" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "published_strategy_snapshots" ALTER COLUMN "user_intent_summary" DROP DEFAULT,
ALTER COLUMN "strategy_summary" DROP DEFAULT,
ALTER COLUMN "script_summary" DROP DEFAULT,
ALTER COLUMN "locked_params" DROP DEFAULT;

-- AlterTable
ALTER TABLE "strategy_instances" ADD COLUMN     "view_only_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "idx_strategy_instance_creator_view_only" ON "strategy_instances"("created_by", "view_only_at", "archived_at", "updated_at");
