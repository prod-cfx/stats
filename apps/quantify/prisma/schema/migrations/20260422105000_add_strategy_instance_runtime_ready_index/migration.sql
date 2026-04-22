CREATE INDEX "idx_strategy_instance_runtime_ready_scan"
  ON "strategy_instances" ("status", "mode", "runtime_binding_status");
