-- Add message bus outbox storage for quantify.
-- This migration is intentionally scoped to the outbox contract only.

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'CLAIMED', 'RETRY', 'SENT', 'DEAD');

CREATE TABLE "outbox_message" (
  "id" BIGSERIAL NOT NULL,
  "topic" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_visible_at" TIMESTAMP(3) NOT NULL,
  "locked_by" TEXT,
  "locked_at" TIMESTAMP(3),
  "last_error" TEXT,
  "dedupe_key" TEXT,
  "correlation_id" TEXT,
  "partition_key" TEXT,
  "priority" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "outbox_message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_outbox_status_visible_at" ON "outbox_message"("status", "next_visible_at");
CREATE INDEX "idx_outbox_locked_at" ON "outbox_message"("locked_at");
CREATE INDEX "idx_outbox_created_at" ON "outbox_message"("created_at");
CREATE INDEX "idx_outbox_dedupe_key" ON "outbox_message"("dedupe_key");
