-- persist backtest jobs and full reports for long-term retrieval

CREATE TABLE "backtest_jobs" (
  "id" TEXT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "input_summary" JSONB NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "backtest_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_backtest_jobs_owner_created_at"
  ON "backtest_jobs"("owner_user_id", "created_at");

CREATE INDEX "idx_backtest_jobs_owner_status"
  ON "backtest_jobs"("owner_user_id", "status");
