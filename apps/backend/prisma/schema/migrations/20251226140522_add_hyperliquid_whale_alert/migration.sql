-- CreateTable
CREATE TABLE "hyperliquid_whale_alerts" (
    "id" SERIAL NOT NULL,
    "user_address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "position_size" DECIMAL(30,10) NOT NULL,
    "entry_price" DECIMAL(30,10) NOT NULL,
    "liquidation_price" DECIMAL(30,10) NOT NULL,
    "position_value_usd" DECIMAL(30,10) NOT NULL,
    "position_action" INTEGER NOT NULL,
    "create_time" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hyperliquid_whale_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_whale_alert_symbol_time" ON "hyperliquid_whale_alerts"("symbol", "create_time");

-- CreateIndex
CREATE INDEX "idx_whale_alert_user_time" ON "hyperliquid_whale_alerts"("user_address", "create_time");

-- CreateIndex
CREATE INDEX "idx_whale_alert_time" ON "hyperliquid_whale_alerts"("create_time");

-- CreateIndex
CREATE INDEX "idx_whale_alert_value" ON "hyperliquid_whale_alerts"("position_value_usd");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_whale_alert_user_symbol_time_action" ON "hyperliquid_whale_alerts"("user_address", "symbol", "create_time", "position_action");
