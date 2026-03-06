-- CreateEnum
CREATE TYPE "WhaleNotificationRuleType" AS ENUM ('ADDRESS', 'SYMBOL');

-- CreateTable
CREATE TABLE "whale_notification_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "WhaleNotificationRuleType" NOT NULL,
    "whale_address" TEXT,
    "symbol" TEXT,
    "threshold_usd" DECIMAL(30,10) NOT NULL,
    "note" TEXT,
    "channel_web" BOOLEAN NOT NULL DEFAULT true,
    "channel_email" BOOLEAN NOT NULL DEFAULT false,
    "channel_telegram" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whale_notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whale_notification_rule_addresses" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "whale_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whale_notification_rule_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whale_notification_rule_symbol_overrides" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "whale_address" TEXT,
    "symbol" TEXT NOT NULL,
    "min_trade_value_usd" DECIMAL(30,10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whale_notification_rule_symbol_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_whale_notify_rules_user_created" ON "whale_notification_rules"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_whale_notify_rules_user_active" ON "whale_notification_rules"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_whale_notify_rule_address" ON "whale_notification_rule_addresses"("rule_id", "whale_address");

-- CreateIndex
CREATE INDEX "idx_whale_notify_rule_address" ON "whale_notification_rule_addresses"("whale_address");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_whale_notify_rule_symbol_override" ON "whale_notification_rule_symbol_overrides"("rule_id", "whale_address", "symbol");

-- CreateIndex
CREATE INDEX "idx_whale_notify_rule_override_symbol" ON "whale_notification_rule_symbol_overrides"("symbol");

-- AddForeignKey
ALTER TABLE "whale_notification_rules" ADD CONSTRAINT "whale_notification_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whale_notification_rule_addresses" ADD CONSTRAINT "whale_notification_rule_addresses_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "whale_notification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whale_notification_rule_symbol_overrides" ADD CONSTRAINT "whale_notification_rule_symbol_overrides_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "whale_notification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
