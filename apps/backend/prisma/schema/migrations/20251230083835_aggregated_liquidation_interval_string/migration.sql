/*
  手工调整：
  - 将 aggregated_liquidation_history.interval 从枚举 MarketTimeframe 修改为 TEXT
  - 使用 USING 子句做类型转换，保留已有数据
*/

-- 先删除旧的唯一索引（如果存在）
DROP INDEX IF EXISTS "uniq_agg_liq_symbol_exchange_interval_time";

-- 安全地将枚举列转换为 TEXT，保留现有值
ALTER TABLE "aggregated_liquidation_history"
ALTER COLUMN "interval" TYPE TEXT USING "interval"::TEXT;

-- 重新创建唯一索引
CREATE UNIQUE INDEX "uniq_agg_liq_symbol_exchange_interval_time"
  ON "aggregated_liquidation_history"("symbol", "exchange_code", "interval", "timestamp");
