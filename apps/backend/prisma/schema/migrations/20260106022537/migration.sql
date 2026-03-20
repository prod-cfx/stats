-- CreateTable
CREATE TABLE "futures_price_history" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange_code" TEXT NOT NULL,
    "contract_type" TEXT,
    "interval" "MarketTimeframe" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(30,10) NOT NULL,
    "high" DECIMAL(30,10) NOT NULL,
    "low" DECIMAL(30,10) NOT NULL,
    "close" DECIMAL(30,10) NOT NULL,
    "volume_usd" DECIMAL(30,10),
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "futures_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_trades" (
    "id" SERIAL NOT NULL,
    "exchange" TEXT NOT NULL,
    "instrument_type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "base_asset" TEXT NOT NULL,
    "quote_asset" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "price" DECIMAL(30,10) NOT NULL,
    "size" DECIMAL(30,10) NOT NULL,
    "side" TEXT NOT NULL,
    "trade_timestamp" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades_pair_configs" (
    "id" TEXT NOT NULL,
    "pair_id" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "base_asset" TEXT NOT NULL,
    "quote_asset" TEXT NOT NULL,
    "instrument_type" "InstrumentType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pair_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_futures_price_symbol_exchange_interval_time" ON "futures_price_history"("symbol", "exchange_code", "interval", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_futures_price_symbol_exchange_contract_interval_time" ON "futures_price_history"("symbol", "exchange_code", "contract_type", "interval", "timestamp");

-- CreateIndex
CREATE INDEX "idx_trade_exchange_instrument_symbol_time" ON "market_trades"("exchange", "instrument_type", "symbol", "trade_timestamp");

-- CreateIndex
CREATE INDEX "idx_trade_timestamp" ON "market_trades"("trade_timestamp");

-- CreateIndex
CREATE INDEX "idx_trade_assets_time" ON "market_trades"("base_asset", "quote_asset", "trade_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "market_trades_exchange_instrument_type_symbol_trade_id_key" ON "market_trades"("exchange", "instrument_type", "symbol", "trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "trades_pair_configs_pair_id_key" ON "trades_pair_configs"("pair_id");

-- CreateIndex
CREATE INDEX "trades_pair_configs_exchange_idx" ON "trades_pair_configs"("exchange");

-- CreateIndex
CREATE INDEX "trades_pair_configs_instrument_type_idx" ON "trades_pair_configs"("instrument_type");

-- CreateIndex
CREATE INDEX "trades_pair_configs_enabled_idx" ON "trades_pair_configs"("enabled");

-- CreateIndex
CREATE INDEX "trades_pair_configs_priority_idx" ON "trades_pair_configs"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "trades_pair_configs_symbol_exchange_instrument_type_key" ON "trades_pair_configs"("symbol", "exchange", "instrument_type");
