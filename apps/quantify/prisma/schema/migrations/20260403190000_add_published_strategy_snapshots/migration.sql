-- publish immutable strategy snapshots and trace backtest jobs to the exact snapshot/script/spec hashes

ALTER TYPE "public"."LlmCodegenSessionStatus"
ADD VALUE IF NOT EXISTS 'VALIDATING_CONSISTENCY';

ALTER TYPE "public"."LlmCodegenSessionStatus"
ADD VALUE IF NOT EXISTS 'CONSISTENCY_FAILED';

CREATE TABLE "published_strategy_snapshots" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "strategy_template_id" TEXT,
  "strategy_instance_id" TEXT,
  "snapshot_hash" TEXT NOT NULL,
  "script_hash" TEXT NOT NULL,
  "spec_hash" TEXT NOT NULL,
  "script_snapshot" TEXT NOT NULL,
  "spec_snapshot" JSONB NOT NULL,
  "consistency_report" JSONB NOT NULL,
  "params_snapshot" JSONB,
  "execution_policy" JSONB,
  "data_requirements" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "published_strategy_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_published_strategy_snapshots_session_created_at"
  ON "published_strategy_snapshots"("session_id", "created_at");

CREATE INDEX "idx_published_strategy_snapshots_instance_created_at"
  ON "published_strategy_snapshots"("strategy_instance_id", "created_at");

CREATE INDEX "idx_published_strategy_snapshots_snapshot_hash"
  ON "published_strategy_snapshots"("snapshot_hash");

ALTER TABLE "published_strategy_snapshots"
ADD CONSTRAINT "published_strategy_snapshots_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "public"."llm_strategy_codegen_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "backtest_jobs"
ADD COLUMN "snapshot_id" TEXT,
ADD COLUMN "snapshot_hash" TEXT,
ADD COLUMN "script_hash" TEXT,
ADD COLUMN "spec_hash" TEXT;

CREATE INDEX "idx_backtest_jobs_snapshot_id"
  ON "backtest_jobs"("snapshot_id");
