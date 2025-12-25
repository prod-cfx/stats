-- CreateTable
CREATE TABLE "exchange_configs" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "intro" TEXT,
  "website_url" TEXT,
  "venue_type" "VenueType",
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort" INTEGER NOT NULL DEFAULT 100,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exchange_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_configs_code_key" ON "exchange_configs"("code");

-- CreateIndex
CREATE INDEX "exchange_configs_venue_type_idx" ON "exchange_configs"("venue_type");

-- CreateIndex
CREATE INDEX "exchange_configs_enabled_idx" ON "exchange_configs"("enabled");

-- CreateIndex
CREATE INDEX "exchange_configs_sort_idx" ON "exchange_configs"("sort");

