-- CreateTable
CREATE TABLE "hyperliquid_whale_trades" (
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

-- CreateIndex
CREATE INDEX "idx_whale_trade_symbol_time" ON "hyperliquid_whale_trades"("symbol", "trade_time");

-- CreateIndex
CREATE INDEX "idx_whale_trade_user_time" ON "hyperliquid_whale_trades"("user_address", "trade_time");

-- CreateIndex
CREATE INDEX "idx_whale_trade_time" ON "hyperliquid_whale_trades"("trade_time");

-- CreateIndex
CREATE INDEX "idx_whale_trade_value" ON "hyperliquid_whale_trades"("trade_value_usd");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_whale_trade_user_symbol_time_side" ON "hyperliquid_whale_trades"("user_address", "symbol", "trade_time", "side");
