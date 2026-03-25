CREATE TABLE "backtest_capability_configs" (
    "id" TEXT NOT NULL,
    "allowed_symbols" JSONB NOT NULL,
    "allowed_base_timeframes" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backtest_capability_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_backtest_capability_configs_active_updated"
ON "backtest_capability_configs"("is_active", "updated_at");
