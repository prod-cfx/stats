-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarketTimeframe" ADD VALUE '3m';
ALTER TYPE "MarketTimeframe" ADD VALUE '30m';
ALTER TYPE "MarketTimeframe" ADD VALUE '6h';
ALTER TYPE "MarketTimeframe" ADD VALUE '8h';
ALTER TYPE "MarketTimeframe" ADD VALUE '12h';
ALTER TYPE "MarketTimeframe" ADD VALUE '1w';

-- RenameIndex
ALTER INDEX "unique_oi_record" RENAME TO "open_interest_exchange_symbol_data_timestamp_key";
