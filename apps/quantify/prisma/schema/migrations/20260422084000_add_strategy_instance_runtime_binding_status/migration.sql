ALTER TABLE "strategy_instances"
  ADD COLUMN "runtime_binding_status" TEXT,
  ADD COLUMN "runtime_binding_error_code" TEXT,
  ADD COLUMN "runtime_binding_updated_at" TIMESTAMP(3);
