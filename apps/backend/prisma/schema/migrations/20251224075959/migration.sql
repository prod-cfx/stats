-- CreateTable
CREATE TABLE "orderbook_pair_configs" (
    "id" TEXT NOT NULL,
    "pair_id" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "base_asset" TEXT NOT NULL,
    "quote_asset" TEXT NOT NULL,
    "venue_type" TEXT NOT NULL,
    "instrument_type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pull_interval_seconds" INTEGER,
    "depth_levels" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orderbook_pair_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orderbook_pair_configs_pair_id_key" ON "orderbook_pair_configs"("pair_id");

-- CreateIndex
CREATE INDEX "orderbook_pair_configs_venue_idx" ON "orderbook_pair_configs"("venue");

-- CreateIndex
CREATE INDEX "orderbook_pair_configs_venue_type_idx" ON "orderbook_pair_configs"("venue_type");

-- CreateIndex
CREATE INDEX "orderbook_pair_configs_enabled_idx" ON "orderbook_pair_configs"("enabled");

-- CreateIndex
CREATE INDEX "orderbook_pair_configs_priority_idx" ON "orderbook_pair_configs"("priority");
