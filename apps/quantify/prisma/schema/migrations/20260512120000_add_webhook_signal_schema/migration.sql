-- Add persistence-only schema for external signal webhook subscriptions and intake records.
-- PR2 scope: schema, indexes, and sentinel only. Runtime writer/consumer/API surfaces land later.

CREATE TYPE "WebhookSignalSubscriptionStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ROTATED');
CREATE TYPE "WebhookSignalSignatureStatus" AS ENUM ('ACCEPTED', 'REJECTED');

CREATE TABLE "webhook_signal_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "strategy_instance_id" TEXT NOT NULL,
  "provider" TEXT,
  "signal_id" TEXT NOT NULL,
  "secret_ciphertext" TEXT NOT NULL,
  "secret_version" INTEGER NOT NULL DEFAULT 1,
  "status" "WebhookSignalSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "last_accepted_at" TIMESTAMP(3),
  "rotated_at" TIMESTAMP(3),
  "disabled_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_signal_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_signal_events" (
  "id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "strategy_instance_id" TEXT NOT NULL,
  "provider" TEXT,
  "signal_id" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "headers" JSONB,
  "raw_body_sha256" TEXT,
  "signature_status" "WebhookSignalSignatureStatus" NOT NULL DEFAULT 'ACCEPTED',
  "source_timestamp" TIMESTAMP(3),
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_signal_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_signal_audits" (
  "id" BIGSERIAL NOT NULL,
  "subscription_id" TEXT,
  "event_id" TEXT,
  "strategy_instance_id" TEXT,
  "provider" TEXT,
  "signal_id" TEXT,
  "dedupe_key" TEXT,
  "signature_status" "WebhookSignalSignatureStatus" NOT NULL,
  "reason" TEXT,
  "request_headers" JSONB,
  "raw_body_sha256" TEXT,
  "remote_ip" TEXT,
  "user_agent" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_signal_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_webhook_signal_subscriptions_active_instance_signal"
  ON "webhook_signal_subscriptions"("strategy_instance_id", "signal_id")
  WHERE "status" = 'ACTIVE';

CREATE INDEX "idx_webhook_signal_subscriptions_user_status"
  ON "webhook_signal_subscriptions"("user_id", "status");
CREATE INDEX "idx_webhook_signal_subscriptions_instance_signal_status"
  ON "webhook_signal_subscriptions"("strategy_instance_id", "signal_id", "status");
CREATE INDEX "idx_webhook_signal_subscriptions_created_at"
  ON "webhook_signal_subscriptions"("created_at");
CREATE UNIQUE INDEX "uniq_webhook_signal_subscriptions_id_instance_signal"
  ON "webhook_signal_subscriptions"("id", "strategy_instance_id", "signal_id");

CREATE UNIQUE INDEX "uniq_webhook_signal_events_subscription_dedupe_key"
  ON "webhook_signal_events"("subscription_id", "dedupe_key");
CREATE INDEX "idx_webhook_signal_events_subscription_received"
  ON "webhook_signal_events"("subscription_id", "received_at");
CREATE INDEX "idx_webhook_signal_events_instance_signal_received"
  ON "webhook_signal_events"("strategy_instance_id", "signal_id", "received_at");
CREATE INDEX "idx_webhook_signal_events_signature_received"
  ON "webhook_signal_events"("signature_status", "received_at");

CREATE INDEX "idx_webhook_signal_audits_subscription_received"
  ON "webhook_signal_audits"("subscription_id", "received_at");
CREATE INDEX "idx_webhook_signal_audits_instance_signal_received"
  ON "webhook_signal_audits"("strategy_instance_id", "signal_id", "received_at");
CREATE INDEX "idx_webhook_signal_audits_signature_received"
  ON "webhook_signal_audits"("signature_status", "received_at");
CREATE INDEX "idx_webhook_signal_audits_dedupe_key"
  ON "webhook_signal_audits"("dedupe_key");

ALTER TABLE "webhook_signal_subscriptions"
  ADD CONSTRAINT "webhook_signal_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_signal_subscriptions"
  ADD CONSTRAINT "webhook_signal_subscriptions_strategy_instance_id_fkey"
  FOREIGN KEY ("strategy_instance_id") REFERENCES "strategy_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_signal_events"
  ADD CONSTRAINT "webhook_signal_events_subscription_id_fkey"
  FOREIGN KEY ("subscription_id", "strategy_instance_id", "signal_id")
  REFERENCES "webhook_signal_subscriptions"("id", "strategy_instance_id", "signal_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_signal_events"
  ADD CONSTRAINT "webhook_signal_events_strategy_instance_id_fkey"
  FOREIGN KEY ("strategy_instance_id") REFERENCES "strategy_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_signal_audits"
  ADD CONSTRAINT "webhook_signal_audits_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "webhook_signal_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "webhook_signal_audits"
  ADD CONSTRAINT "webhook_signal_audits_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "webhook_signal_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "webhook_signal_audits"
  ADD CONSTRAINT "webhook_signal_audits_strategy_instance_id_fkey"
  FOREIGN KEY ("strategy_instance_id") REFERENCES "strategy_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sentinel SQL:
-- SELECT
--   relname,
--   n_live_tup
-- FROM pg_stat_user_tables
-- WHERE relname IN ('webhook_signal_subscriptions', 'webhook_signal_events', 'webhook_signal_audits');
