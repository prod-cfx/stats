CREATE TABLE "strategy_runtime_execution_states" (
  "id" TEXT NOT NULL,
  "strategy_instance_id" TEXT NOT NULL,
  "published_snapshot_id" TEXT NOT NULL,
  "snapshot_hash" TEXT NOT NULL,
  "execution_semantic_key" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "failure_reason" TEXT,
  "failure_code" TEXT,
  "last_attempt_at" TIMESTAMP(3),
  "consumed_at" TIMESTAMP(3),
  "cooldown_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "strategy_runtime_execution_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "strategy_runtime_execution_state_unique"
  ON "strategy_runtime_execution_states"("strategy_instance_id", "published_snapshot_id", "execution_semantic_key");

CREATE INDEX "strategy_runtime_execution_state_instance_idx"
  ON "strategy_runtime_execution_states"("strategy_instance_id");

ALTER TABLE "strategy_runtime_execution_states"
  ADD CONSTRAINT "strategy_runtime_execution_states_strategy_instance_id_fkey"
  FOREIGN KEY ("strategy_instance_id") REFERENCES "strategy_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
