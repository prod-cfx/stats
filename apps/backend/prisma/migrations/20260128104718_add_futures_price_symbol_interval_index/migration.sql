-- CreateIndex
CREATE INDEX "idx_futures_price_symbol_interval_time" ON "futures_price_history"("symbol", "interval", "timestamp");
