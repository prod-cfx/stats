-- CreateEnum
CREATE TYPE "WhaleNotificationChannel" AS ENUM ('WEB', 'EMAIL', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "WhaleNotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED_COOLDOWN');

-- CreateTable
CREATE TABLE "whale_notification_deliveries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "channel" "WhaleNotificationChannel" NOT NULL,
    "status" "WhaleNotificationDeliveryStatus" NOT NULL,
    "whale_address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "trade_value_usd" DECIMAL(30,10) NOT NULL,
    "trade_time" TIMESTAMP(3) NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whale_notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_whale_notify_delivery_dedup" ON "whale_notification_deliveries"("dedup_key", "channel", "created_at");

-- CreateIndex
CREATE INDEX "idx_whale_notify_delivery_user_created" ON "whale_notification_deliveries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_whale_notify_delivery_status_created" ON "whale_notification_deliveries"("status", "created_at");

-- AddForeignKey
ALTER TABLE "whale_notification_deliveries" ADD CONSTRAINT "whale_notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whale_notification_deliveries" ADD CONSTRAINT "whale_notification_deliveries_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "whale_notification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
