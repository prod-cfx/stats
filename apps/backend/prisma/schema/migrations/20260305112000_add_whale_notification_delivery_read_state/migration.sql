-- AlterTable
ALTER TABLE "whale_notification_deliveries"
ADD COLUMN "title" TEXT,
ADD COLUMN "content" TEXT,
ADD COLUMN "is_read" BOOLEAN NOT NULL DEFAULT false;
