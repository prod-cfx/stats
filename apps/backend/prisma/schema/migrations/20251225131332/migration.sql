-- CreateTable
CREATE TABLE "polymarket_events" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "subcategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seriesId" TEXT,
    "status" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "resolutionSource" TEXT,
    "resolutionTime" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawPayload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polymarket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polymarket_markets" (
    "id" SERIAL NOT NULL,
    "marketId" TEXT NOT NULL,
    "eventId" INTEGER,
    "eventExternalId" TEXT,
    "slug" TEXT,
    "question" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outcomeType" TEXT,
    "status" TEXT,
    "resolutionSource" TEXT,
    "resolutionTime" TIMESTAMP(3),
    "startTradingAt" TIMESTAMP(3),
    "endTradingAt" TIMESTAMP(3),
    "lastUpdatedAt" TIMESTAMP(3),
    "feeRate" DECIMAL(10,6),
    "liquidity" DECIMAL(32,16),
    "volume_24h" DECIMAL(32,16),
    "volumeTotal" DECIMAL(32,16),
    "openInterest" DECIMAL(32,16),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rawPayload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polymarket_markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polymarket_outcomes" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "outcomeTokenId" TEXT NOT NULL,
    "name" TEXT,
    "shortName" TEXT,
    "side" TEXT,
    "price" DECIMAL(32,16),
    "probability" DECIMAL(32,16),
    "liquidity" DECIMAL(32,16),
    "poolBalance" DECIMAL(32,16),
    "lastTradePrice" DECIMAL(32,16),
    "lastTradeAt" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polymarket_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polymarket_orderbook_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "marketId" INTEGER,
    "outcomeId" INTEGER,
    "marketExternalId" TEXT NOT NULL,
    "outcomeTokenId" TEXT NOT NULL,
    "seq" BIGINT,
    "bids" JSONB NOT NULL,
    "asks" JSONB NOT NULL,
    "spread" DECIMAL(32,16),
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'POLYMARKET',
    "rawPayload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polymarket_orderbook_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "polymarket_events_eventId_key" ON "polymarket_events"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "polymarket_markets_marketId_key" ON "polymarket_markets"("marketId");

-- CreateIndex
CREATE INDEX "idx_polymarket_markets_event" ON "polymarket_markets"("eventId");

-- CreateIndex
CREATE INDEX "idx_polymarket_markets_category" ON "polymarket_markets"("category");

-- CreateIndex
CREATE UNIQUE INDEX "polymarket_outcomes_outcomeTokenId_key" ON "polymarket_outcomes"("outcomeTokenId");

-- CreateIndex
CREATE INDEX "idx_polymarket_outcomes_market" ON "polymarket_outcomes"("marketId");

-- CreateIndex
CREATE INDEX "idx_polymarket_orderbook_time" ON "polymarket_orderbook_snapshots"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_polymarket_orderbook_slice" ON "polymarket_orderbook_snapshots"("marketExternalId", "outcomeTokenId", "capturedAt");

-- AddForeignKey
ALTER TABLE "polymarket_markets" ADD CONSTRAINT "polymarket_markets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "polymarket_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polymarket_outcomes" ADD CONSTRAINT "polymarket_outcomes_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "polymarket_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polymarket_orderbook_snapshots" ADD CONSTRAINT "polymarket_orderbook_snapshots_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "polymarket_markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polymarket_orderbook_snapshots" ADD CONSTRAINT "polymarket_orderbook_snapshots_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "polymarket_outcomes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "liquidation_heatmap_snapshots_fetched_at_idx" RENAME TO "liq_heatmap_fetched_at_idx";

-- RenameIndex
ALTER INDEX "liquidation_heatmap_snapshots_query_idx" RENAME TO "liq_heatmap_latest_query_idx";

-- RenameIndex
ALTER INDEX "liquidation_heatmap_snapshots_symbol_exchange_code_contract_typ" RENAME TO "liq_heatmap_symbol_exchange_contract_idx";

-- RenameIndex
ALTER INDEX "unique_market_config" RENAME TO "orderbook_pair_configs_symbol_venue_instrument_type_key";
