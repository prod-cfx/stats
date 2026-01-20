-- AlterTable: 增加数量字段精度以支持低价币（如 PEPE $0.0000001）
-- 低价币数量可达数十万亿（16位整数），Decimal(30,10) 仅支持 20 位整数会溢出
-- 修改为 Decimal(40,10) 提供 30 位整数 + 10 位小数的精度
ALTER TABLE "futures_pairs_markets" 
  ALTER COLUMN "long_volume_quantity" SET DATA TYPE DECIMAL(40,10),
  ALTER COLUMN "short_volume_quantity" SET DATA TYPE DECIMAL(40,10),
  ALTER COLUMN "open_interest_quantity" SET DATA TYPE DECIMAL(40,10);
