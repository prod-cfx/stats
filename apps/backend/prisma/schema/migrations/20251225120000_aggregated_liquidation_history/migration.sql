-- CreateTable
CREATE TABLE "aggregated_liquidation_history" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange_code" TEXT,
    "interval" "MarketTimeframe" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "aggregated_long_liquidation_usd" DECIMAL(30,10) NOT NULL,
    "aggregated_short_liquidation_usd" DECIMAL(30,10) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aggregated_liquidation_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_agg_liq_symbol_exchange_interval_time"
  ON "aggregated_liquidation_history"("symbol", "exchange_code", "interval", "timestamp");

-- CreateIndex
CREATE INDEX "idx_agg_liq_symbol_exchange_time"
  ON "aggregated_liquidation_history"("symbol", "exchange_code", "timestamp");

