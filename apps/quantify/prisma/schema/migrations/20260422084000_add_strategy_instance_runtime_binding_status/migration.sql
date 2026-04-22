ALTER TABLE "strategy_instances"
  ADD COLUMN "runtime_binding_status" TEXT,
  ADD COLUMN "runtime_binding_error_code" TEXT,
  ADD COLUMN "runtime_binding_updated_at" TIMESTAMP(3);

UPDATE "strategy_instances"
SET
  "runtime_binding_status" = 'READY',
  "runtime_binding_error_code" = NULL,
  "runtime_binding_updated_at" = COALESCE("updated_at", NOW())
WHERE
  "runtime_binding_status" IS NULL
  AND "status" = 'running'
  AND "mode" IN ('LIVE', 'TESTNET');
