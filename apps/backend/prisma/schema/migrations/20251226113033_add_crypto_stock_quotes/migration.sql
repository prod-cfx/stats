-- CreateTable
CREATE TABLE "crypto_stock_quotes" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "exchange" TEXT,
    "price" DECIMAL(20,8) NOT NULL,
    "open_price" DECIMAL(20,8),
    "high_price" DECIMAL(20,8),
    "low_price" DECIMAL(20,8),
    "close_price" DECIMAL(20,8),
    "volume" DECIMAL(30,10),
    "turnover" DECIMAL(30,10),
    "price_change" DECIMAL(20,8),
    "price_change_percent" DECIMAL(10,4),
    "market_cap" DECIMAL(30,2),
    "pe_ratio" DECIMAL(10,4),
    "high_52_week" DECIMAL(20,8),
    "low_52_week" DECIMAL(20,8),
    "source" TEXT NOT NULL DEFAULT 'BBX',
    "quote_timestamp" TIMESTAMP(3) NOT NULL,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crypto_stock_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_crypto_stock_quote_symbol_source_time" ON "crypto_stock_quotes"("symbol", "source", "quote_timestamp");

-- CreateIndex
CREATE INDEX "idx_crypto_stock_quote_symbol_time" ON "crypto_stock_quotes"("symbol", "quote_timestamp");

-- CreateIndex
CREATE INDEX "idx_crypto_stock_quote_source_time" ON "crypto_stock_quotes"("source", "quote_timestamp");
