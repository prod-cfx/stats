-- CreateTable
CREATE TABLE "long_short_ratios" (
    "id" SERIAL NOT NULL,
    "trading_pair_id" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "long_short_ratio" DECIMAL(18,8) NOT NULL,
    "long_account_ratio" DECIMAL(18,8),
    "short_account_ratio" DECIMAL(18,8),
    "long_volume" DECIMAL(30,10),
    "short_volume" DECIMAL(30,10),
    "long_short_account_ratio" DECIMAL(18,8),
    "source" TEXT NOT NULL DEFAULT 'COINGLASS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "long_short_ratios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_long_short_ratio_pair_time" ON "long_short_ratios"("trading_pair_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_long_short_ratio_pair_interval_time" ON "long_short_ratios"("trading_pair_id", "interval", "timestamp");
