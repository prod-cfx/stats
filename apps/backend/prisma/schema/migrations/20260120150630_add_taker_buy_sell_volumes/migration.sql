-- CreateTable
CREATE TABLE "taker_buy_sell_volumes" (
    "id" SERIAL NOT NULL,
    "exchange" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "buy_ratio" DECIMAL(10,4) NOT NULL,
    "sell_ratio" DECIMAL(10,4) NOT NULL,
    "buy_vol_usd" DECIMAL(20,2) NOT NULL,
    "sell_vol_usd" DECIMAL(20,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taker_buy_sell_volumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_taker_volume_exchange_symbol_range_time" ON "taker_buy_sell_volumes"("exchange", "symbol", "range", "timestamp");

-- CreateIndex
CREATE INDEX "idx_taker_volume_exchange_symbol_time" ON "taker_buy_sell_volumes"("exchange", "symbol", "timestamp");
