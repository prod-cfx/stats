-- Align e2e database schema with current Prisma datamodel
ALTER TABLE "polymarket_markets"
ADD COLUMN "eventTitleZh" TEXT,
ADD COLUMN "questionZh" TEXT;

ALTER TABLE "polymarket_outcomes"
ADD COLUMN "nameZh" TEXT,
ADD COLUMN "shortNameZh" TEXT;

CREATE TABLE "hyperliquid_whale_positions" (
    "id" SERIAL NOT NULL,
    "user_address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "position_size" DECIMAL(30,10) NOT NULL,
    "entry_price" DECIMAL(30,10) NOT NULL,
    "liquidation_price" DECIMAL(30,10),
    "position_value_usd" DECIMAL(30,10) NOT NULL,
    "pnl" DECIMAL(30,10),
    "roe" DECIMAL(18,8),
    "leverage" DECIMAL(10,2),
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "snapshot_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hyperliquid_whale_positions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_whale_position_user_address" ON "hyperliquid_whale_positions"("user_address");
CREATE INDEX "idx_whale_position_symbol" ON "hyperliquid_whale_positions"("symbol");
CREATE INDEX "idx_whale_position_value" ON "hyperliquid_whale_positions"("position_value_usd");
CREATE INDEX "idx_whale_position_symbol_value_desc" ON "hyperliquid_whale_positions"("symbol", "position_value_usd" DESC);
CREATE INDEX "idx_whale_position_snapshot_time" ON "hyperliquid_whale_positions"("snapshot_time");
CREATE UNIQUE INDEX "uniq_whale_position_user_symbol" ON "hyperliquid_whale_positions"("user_address", "symbol");
