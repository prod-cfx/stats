-- CreateTable
CREATE TABLE "futures_pairs_markets" (
    "id" SERIAL NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "exchange_name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "current_price" DECIMAL(30,10) NOT NULL,
    "index_price" DECIMAL(30,10),
    "price_change_percent_24h" DECIMAL(10,4),
    "volume_usd" DECIMAL(30,10) NOT NULL,
    "volume_usd_change_percent_24h" DECIMAL(10,4),
    "long_volume_usd" DECIMAL(30,10),
    "short_volume_usd" DECIMAL(30,10),
    "long_volume_quantity" DECIMAL(30,10),
    "short_volume_quantity" DECIMAL(30,10),
    "open_interest_quantity" DECIMAL(30,10),
    "open_interest_usd" DECIMAL(30,10),
    "open_interest_change_percent_24h" DECIMAL(10,4),
    "long_liquidation_usd_24h" DECIMAL(30,10),
    "short_liquidation_usd_24h" DECIMAL(30,10),
    "funding_rate" DECIMAL(18,8),
    "next_funding_time" BIGINT,
    "open_interest_volume_ratio" DECIMAL(10,4),
    "oi_vol_ratio_change_percent_24h" DECIMAL(10,4),
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "futures_pairs_markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hyperliquid_user_fills" (
    "id" SERIAL NOT NULL,
    "user_address" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "price" DECIMAL(30,10) NOT NULL,
    "size" DECIMAL(30,10) NOT NULL,
    "side" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "start_position" DECIMAL(30,10) NOT NULL,
    "dir" TEXT NOT NULL,
    "closed_pnl" DECIMAL(30,10) NOT NULL,
    "hash" TEXT NOT NULL,
    "order_id" BIGINT NOT NULL,
    "trade_id" BIGINT NOT NULL,
    "crossed" BOOLEAN NOT NULL,
    "fee" DECIMAL(30,10) NOT NULL,
    "liquidation" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'HYPERLIQUID',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hyperliquid_user_fills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hyperliquid_user_orders" (
    "id" SERIAL NOT NULL,
    "user_address" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "order_id" BIGINT NOT NULL,
    "client_order_id" TEXT,
    "side" TEXT NOT NULL,
    "limit_price" DECIMAL(30,10) NOT NULL,
    "size" DECIMAL(30,10) NOT NULL,
    "original_size" DECIMAL(30,10) NOT NULL,
    "order_type" TEXT,
    "trigger_price" DECIMAL(30,10),
    "trigger_condition" TEXT,
    "reduce_only" BOOLEAN,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'HYPERLIQUID',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hyperliquid_user_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hyperliquid_user_funding" (
    "id" SERIAL NOT NULL,
    "user_address" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "funding_rate" DECIMAL(30,10) NOT NULL,
    "szi" DECIMAL(30,10) NOT NULL,
    "usdc" DECIMAL(30,10) NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'HYPERLIQUID',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hyperliquid_user_funding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_futures_pairs_market_symbol_exchange" ON "futures_pairs_markets"("symbol", "exchange_name");

-- CreateIndex
CREATE INDEX "idx_futures_pairs_market_exchange" ON "futures_pairs_markets"("exchange_name");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_futures_pairs_market_symbol_exchange_instrument" ON "futures_pairs_markets"("symbol", "exchange_name", "instrument_id");

-- CreateIndex
CREATE INDEX "idx_hyperliquid_fill_user_time" ON "hyperliquid_user_fills"("user_address", "time");

-- CreateIndex
CREATE INDEX "idx_hyperliquid_fill_coin_time" ON "hyperliquid_user_fills"("coin", "time");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_hyperliquid_user_fill" ON "hyperliquid_user_fills"("user_address", "coin", "time", "trade_id");

-- CreateIndex
CREATE INDEX "idx_hyperliquid_order_user_time" ON "hyperliquid_user_orders"("user_address", "timestamp");

-- CreateIndex
CREATE INDEX "idx_hyperliquid_order_status_time" ON "hyperliquid_user_orders"("status", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_hyperliquid_user_order" ON "hyperliquid_user_orders"("user_address", "order_id");

-- CreateIndex
CREATE INDEX "idx_hyperliquid_funding_user_time" ON "hyperliquid_user_funding"("user_address", "time");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_hyperliquid_user_funding" ON "hyperliquid_user_funding"("user_address", "coin", "time");

-- CreateIndex
CREATE INDEX "idx_whale_alert_user_symbol_time" ON "hyperliquid_whale_alerts"("user_address", "symbol", "create_time");
