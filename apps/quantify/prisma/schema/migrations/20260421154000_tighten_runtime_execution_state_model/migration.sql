ALTER TABLE "strategy_runtime_execution_states"
  ADD COLUMN "failure_family" TEXT,
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "running_at" TIMESTAMP(3),
  ADD COLUMN "terminal_at" TIMESTAMP(3);

UPDATE "strategy_runtime_execution_states"
SET
  "status" = CASE
    WHEN "status" = 'failed' THEN 'terminal'
    WHEN "status" = 'cooldown' THEN 'retryable'
    ELSE "status"
  END,
  "failure_family" = CASE
    WHEN "status" = 'failed' THEN 'terminal'
    WHEN "status" = 'cooldown' THEN 'retryable'
    ELSE NULL
  END,
  "attempt_count" = CASE
    WHEN "last_attempt_at" IS NULL THEN 0
    ELSE 1
  END,
  "terminal_at" = CASE
    WHEN "status" = 'failed' THEN COALESCE("last_attempt_at", CURRENT_TIMESTAMP)
    WHEN "status" = 'consumed' THEN COALESCE("consumed_at", "last_attempt_at", CURRENT_TIMESTAMP)
    ELSE NULL
  END;
