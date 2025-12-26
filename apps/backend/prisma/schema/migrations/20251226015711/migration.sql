/*
  Warnings:

  - You are about to drop the column `eventId` on the `polymarket_markets` table. All the data in the column will be lost.
  - You are about to drop the `polymarket_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "polymarket_markets" DROP CONSTRAINT "polymarket_markets_eventId_fkey";

-- DropIndex
DROP INDEX "idx_polymarket_markets_event";

-- AlterTable
ALTER TABLE "polymarket_markets" DROP COLUMN "eventId",
ADD COLUMN     "eventEndTime" TIMESTAMP(3),
ADD COLUMN     "eventSlug" TEXT,
ADD COLUMN     "eventStartTime" TIMESTAMP(3),
ADD COLUMN     "eventTitle" TEXT;

-- DropTable
DROP TABLE "polymarket_events";
