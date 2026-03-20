-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('CEX', 'DEX');

-- CreateEnum
CREATE TYPE "InstrumentType" AS ENUM ('SPOT', 'PERPETUAL', 'FUTURE');

-- AlterTable: Convert venue_type column to enum
ALTER TABLE "orderbook_pair_configs" 
  ALTER COLUMN "venue_type" TYPE "VenueType" USING ("venue_type"::"VenueType");

-- AlterTable: Convert instrument_type column to enum  
ALTER TABLE "orderbook_pair_configs"
  ALTER COLUMN "instrument_type" TYPE "InstrumentType" USING ("instrument_type"::"InstrumentType");
