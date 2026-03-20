-- CreateTable: open_interest_ohlc_history
CREATE TABLE "open_interest_ohlc_history" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "interval" TEXT NOT NULL CHECK ("interval" IN ('m1','m3','m5','m15','m30','h1','h4','h6','h8','h12','d1','w1')),
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
CREATE UNIQUE INDEX "uniq_oi_ohlc_symbol_interval_time" ON "open_interest_ohlc_history"("symbol", "interval", "timestamp");

-- CreateIndex
CREATE INDEX "idx_oi_ohlc_symbol_time" ON "open_interest_ohlc_history"("symbol", "timestamp");

-- Fix drift: CreateTable coins_price_change (if not exists)
CREATE TABLE IF NOT EXISTS "coins_price_change" (
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

-- Fix drift: CreateIndex for coins_price_change
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_coins_price_change_symbol_source" ON "coins_price_change"("symbol", "source");
CREATE INDEX IF NOT EXISTS "idx_coins_price_change_symbol" ON "coins_price_change"("symbol");
CREATE INDEX IF NOT EXISTS "idx_coins_price_change_timestamp" ON "coins_price_change"("data_timestamp");

-- Fix drift: CreateTable hyperliquid_whale_trades (if not exists)
CREATE TABLE IF NOT EXISTS "hyperliquid_whale_trades" (
    "id" SERIAL NOT NULL,
    "user_address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "trade_size" DECIMAL(30,10) NOT NULL,
    "price" DECIMAL(30,10) NOT NULL,
    "trade_value_usd" DECIMAL(30,10) NOT NULL,
    "trade_time" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'HYPERLIQUID_WS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hyperliquid_whale_trades_pkey" PRIMARY KEY ("id")
);

-- Fix drift: CreateIndex for hyperliquid_whale_trades
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_whale_trade_user_symbol_time_side" ON "hyperliquid_whale_trades"("user_address", "symbol", "trade_time", "side");
CREATE INDEX IF NOT EXISTS "idx_whale_trade_symbol_time" ON "hyperliquid_whale_trades"("symbol", "trade_time");
CREATE INDEX IF NOT EXISTS "idx_whale_trade_time" ON "hyperliquid_whale_trades"("trade_time");
CREATE INDEX IF NOT EXISTS "idx_whale_trade_user_time" ON "hyperliquid_whale_trades"("user_address", "trade_time");
CREATE INDEX IF NOT EXISTS "idx_whale_trade_value" ON "hyperliquid_whale_trades"("trade_value_usd");

-- Fix drift: Alter futures_price_history column types (if needed)
-- Note: These changes are idempotent - they will only apply if the column type is different
DO $$
BEGIN
    -- Check and alter open column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'futures_price_history'
        AND column_name = 'open'
        AND data_type != 'numeric'
    ) THEN
        ALTER TABLE "futures_price_history" ALTER COLUMN "open" TYPE DECIMAL(18,8);
    END IF;

    -- Check and alter high column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'futures_price_history'
        AND column_name = 'high'
        AND data_type != 'numeric'
    ) THEN
        ALTER TABLE "futures_price_history" ALTER COLUMN "high" TYPE DECIMAL(18,8);
    END IF;

    -- Check and alter low column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'futures_price_history'
        AND column_name = 'low'
        AND data_type != 'numeric'
    ) THEN
        ALTER TABLE "futures_price_history" ALTER COLUMN "low" TYPE DECIMAL(18,8);
    END IF;

    -- Check and alter close column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'futures_price_history'
        AND column_name = 'close'
        AND data_type != 'numeric'
    ) THEN
        ALTER TABLE "futures_price_history" ALTER COLUMN "close" TYPE DECIMAL(18,8);
    END IF;

    -- Check and alter volume_usd column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'futures_price_history'
        AND column_name = 'volume_usd'
        AND data_type != 'numeric'
    ) THEN
        ALTER TABLE "futures_price_history" ALTER COLUMN "volume_usd" TYPE DECIMAL(20,2);
    END IF;
END $$;
