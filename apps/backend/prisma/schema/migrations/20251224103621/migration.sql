/*
  Warnings:

  - Changed the type of `interval` on the `long_short_ratios` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MarketTimeframe" AS ENUM ('1m', '5m', '15m', '1h', '4h', '1d');

-- AlterTable
ALTER TABLE "long_short_ratios" DROP COLUMN "interval",
ADD COLUMN     "interval" "MarketTimeframe" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uniq_long_short_ratio_pair_interval_time" ON "long_short_ratios"("trading_pair_id", "interval", "timestamp");
