-- CreateTable
CREATE TABLE "open_interest" (
    "id" SERIAL NOT NULL,
    "exchange" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "open_interest_usd" DECIMAL(20,4) NOT NULL,
    "open_interest_quantity" DECIMAL(20,8) NOT NULL,
    "open_interest_by_stable_coin_margin" DECIMAL(20,4),
    "open_interest_quantity_by_coin_margin" DECIMAL(20,8),
    "open_interest_quantity_by_stable_coin_margin" DECIMAL(20,8),
    "open_interest_change_percent_5m" DECIMAL(10,4),
    "open_interest_change_percent_15m" DECIMAL(10,4),
    "open_interest_change_percent_30m" DECIMAL(10,4),
    "open_interest_change_percent_1h" DECIMAL(10,4),
    "open_interest_change_percent_4h" DECIMAL(10,4),
    "open_interest_change_percent_24h" DECIMAL(10,4),
    "data_timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "open_interest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_oi_symbol_timestamp" ON "open_interest"("symbol", "data_timestamp");

-- CreateIndex
CREATE INDEX "idx_oi_exchange_timestamp" ON "open_interest"("exchange", "data_timestamp");

-- CreateIndex
CREATE INDEX "idx_oi_timestamp" ON "open_interest"("data_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "unique_oi_record" ON "open_interest"("exchange", "symbol", "data_timestamp");

-- Add comments
COMMENT ON TABLE "open_interest" IS '持仓量数据表 - 记录加密货币期货的未平仓合约数据';
COMMENT ON COLUMN "open_interest"."exchange" IS '交易所名称，"All" 表示所有交易所汇总';
COMMENT ON COLUMN "open_interest"."symbol" IS '币种符号，如 "BTC", "ETH"';
COMMENT ON COLUMN "open_interest"."open_interest_usd" IS '未平仓合约价值(USD)';
COMMENT ON COLUMN "open_interest"."open_interest_quantity" IS '未平仓合约数量';
COMMENT ON COLUMN "open_interest"."open_interest_by_stable_coin_margin" IS '稳定币本位未平仓合约价值(USD)';
COMMENT ON COLUMN "open_interest"."open_interest_quantity_by_coin_margin" IS '币本位未平仓合约数量';
COMMENT ON COLUMN "open_interest"."open_interest_quantity_by_stable_coin_margin" IS '稳定币本位未平仓合约数量';
COMMENT ON COLUMN "open_interest"."open_interest_change_percent_5m" IS '5分钟内未平仓合约变化百分比';
COMMENT ON COLUMN "open_interest"."open_interest_change_percent_15m" IS '15分钟内未平仓合约变化百分比';
COMMENT ON COLUMN "open_interest"."open_interest_change_percent_30m" IS '30分钟内未平仓合约变化百分比';
COMMENT ON COLUMN "open_interest"."open_interest_change_percent_1h" IS '1小时内未平仓合约变化百分比';
COMMENT ON COLUMN "open_interest"."open_interest_change_percent_4h" IS '4小时内未平仓合约变化百分比';
COMMENT ON COLUMN "open_interest"."open_interest_change_percent_24h" IS '24小时内未平仓合约变化百分比';
COMMENT ON COLUMN "open_interest"."data_timestamp" IS '数据时间戳';
COMMENT ON COLUMN "open_interest"."created_at" IS '创建时间';
COMMENT ON COLUMN "open_interest"."updated_at" IS '更新时间';
