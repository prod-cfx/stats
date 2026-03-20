/*
  Warnings:

  - You are about to alter the column `open` on the `futures_price_history` table. The data in that column could be lost. The data in that column will be cast from `Decimal(30,10)` to `Decimal(18,8)`.
  - You are about to alter the column `high` on the `futures_price_history` table. The data in that column could be lost. The data in that column will be cast from `Decimal(30,10)` to `Decimal(18,8)`.
  - You are about to alter the column `low` on the `futures_price_history` table. The data in that column could be lost. The data in that column will be cast from `Decimal(30,10)` to `Decimal(18,8)`.
  - You are about to alter the column `close` on the `futures_price_history` table. The data in that column could be lost. The data in that column will be cast from `Decimal(30,10)` to `Decimal(18,8)`.
  - You are about to alter the column `volume_usd` on the `futures_price_history` table. The data in that column could be lost. The data in that column will be cast from `Decimal(30,10)` to `Decimal(20,2)`.

*/
-- AlterTable
ALTER TABLE "futures_pairs_markets" ALTER COLUMN "long_volume_quantity" SET DATA TYPE DECIMAL(40,10),
ALTER COLUMN "short_volume_quantity" SET DATA TYPE DECIMAL(40,10),
ALTER COLUMN "open_interest_quantity" SET DATA TYPE DECIMAL(40,10);

-- AlterTable
ALTER TABLE "futures_price_history" ALTER COLUMN "open" SET DATA TYPE DECIMAL(18,8),
ALTER COLUMN "high" SET DATA TYPE DECIMAL(18,8),
ALTER COLUMN "low" SET DATA TYPE DECIMAL(18,8),
ALTER COLUMN "close" SET DATA TYPE DECIMAL(18,8),
ALTER COLUMN "volume_usd" SET DATA TYPE DECIMAL(20,2);
