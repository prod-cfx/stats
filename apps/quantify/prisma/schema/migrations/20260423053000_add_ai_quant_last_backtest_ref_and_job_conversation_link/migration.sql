ALTER TABLE "ai_quant_conversations"
  ADD COLUMN "last_backtest_ref" JSONB;

ALTER TABLE "backtest_jobs"
  ADD COLUMN "conversation_id" TEXT;

CREATE INDEX "idx_backtest_jobs_conversation_created_at"
  ON "backtest_jobs" ("conversation_id", "created_at");

ALTER TABLE "backtest_jobs"
  ADD CONSTRAINT "backtest_jobs_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_quant_conversations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
