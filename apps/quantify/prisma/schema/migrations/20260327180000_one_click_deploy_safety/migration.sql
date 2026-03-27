-- one-click deploy safety hardening

CREATE TABLE "deploy_requests" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "deploy_request_id" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "strategy_instance_id" TEXT,
  "status" TEXT NOT NULL,
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deploy_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_deploy_request_user_request_id"
  ON "deploy_requests"("user_id", "deploy_request_id");

CREATE INDEX "idx_deploy_requests_status_created"
  ON "deploy_requests"("status", "created_at");

CREATE INDEX "idx_deploy_requests_strategy_instance"
  ON "deploy_requests"("strategy_instance_id");

ALTER TABLE "deploy_requests"
  ADD CONSTRAINT "deploy_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deploy_requests"
  ADD CONSTRAINT "deploy_requests_strategy_instance_id_fkey"
  FOREIGN KEY ("strategy_instance_id") REFERENCES "strategy_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "strategy_instance_risk_profiles" (
  "id" TEXT NOT NULL,
  "strategy_instance_id" TEXT NOT NULL,
  "admin_per_order_max_quote" DECIMAL(48,18) NOT NULL,
  "admin_daily_max_quote" DECIMAL(48,18) NOT NULL,
  "admin_max_risk_fraction_cap" DECIMAL(10,8) NOT NULL,
  "user_per_order_max_quote" DECIMAL(48,18) NOT NULL,
  "user_daily_max_quote" DECIMAL(48,18) NOT NULL,
  "user_max_risk_fraction" DECIMAL(10,8) NOT NULL,
  "effective_per_order_max_quote" DECIMAL(48,18) NOT NULL,
  "effective_daily_max_quote" DECIMAL(48,18) NOT NULL,
  "effective_max_risk_fraction" DECIMAL(10,8) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "strategy_instance_risk_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "strategy_instance_risk_profiles_strategy_instance_id_key"
  ON "strategy_instance_risk_profiles"("strategy_instance_id");

ALTER TABLE "strategy_instance_risk_profiles"
  ADD CONSTRAINT "strategy_instance_risk_profiles_strategy_instance_id_fkey"
  FOREIGN KEY ("strategy_instance_id") REFERENCES "strategy_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "strategy_instance_safety_states" (
  "strategy_instance_id" TEXT NOT NULL,
  "consecutive_execution_failures" INTEGER NOT NULL DEFAULT 0,
  "auto_stopped_at" TIMESTAMP(3),
  "auto_stop_reason" TEXT,
  "last_failure_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "strategy_instance_safety_states_pkey" PRIMARY KEY ("strategy_instance_id")
);

ALTER TABLE "strategy_instance_safety_states"
  ADD CONSTRAINT "strategy_instance_safety_states_strategy_instance_id_fkey"
  FOREIGN KEY ("strategy_instance_id") REFERENCES "strategy_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
