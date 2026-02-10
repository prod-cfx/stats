-- CreateTable
CREATE TABLE "coins_price_change" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "current_price" DECIMAL(30,10) NOT NULL,
    "price_change_percent_5m" DECIMAL(10,4),
    "price_change_percent_15m" DECIMAL(10,4),
    "price_change_percent_30m" DECIMAL(10,4),
    "price_change_percent_1h" DECIMAL(10,4),
    "price_change_percent_4h" DECIMAL(10,4),
    "price_change_percent_12h" DECIMAL(10,4),
    "price_change_percent_24h" DECIMAL(10,4),
    "price_amplitude_percent_5m" DECIMAL(10,4),
    "price_amplitude_percent_15m" DECIMAL(10,4),
    "price_amplitude_percent_30m" DECIMAL(10,4),
    "price_amplitude_percent_1h" DECIMAL(10,4),
    "price_amplitude_percent_4h" DECIMAL(10,4),
    "price_amplitude_percent_12h" DECIMAL(10,4),
    "price_amplitude_percent_24h" DECIMAL(10,4),
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "data_timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coins_price_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "open_interest_ohlc_history" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" "MarketTimeframe" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(30,10) NOT NULL,
    "high" DECIMAL(30,10) NOT NULL,
    "low" DECIMAL(30,10) NOT NULL,
    "close" DECIMAL(30,10) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "open_interest_ohlc_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_coins_price_change_symbol" ON "coins_price_change"("symbol");

-- CreateIndex
CREATE INDEX "idx_coins_price_change_timestamp" ON "coins_price_change"("data_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_coins_price_change_symbol_source" ON "coins_price_change"("symbol", "source");

-- CreateIndex
CREATE INDEX "idx_oi_ohlc_symbol_time" ON "open_interest_ohlc_history"("symbol", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_oi_ohlc_symbol_interval_time" ON "open_interest_ohlc_history"("symbol", "interval", "timestamp");

-- CreateIndex
CREATE INDEX "idx_futures_price_symbol_interval_time" ON "futures_price_history"("symbol", "interval", "timestamp");

-- CreateIndex
CREATE INDEX "idx_whale_alert_user_address" ON "hyperliquid_whale_alerts"("user_address");

-- CreateIndex
CREATE INDEX "idx_trade_cleanup_order" ON "market_trades"("exchange", "instrument_type", "symbol", "trade_timestamp" DESC, "id" DESC);
