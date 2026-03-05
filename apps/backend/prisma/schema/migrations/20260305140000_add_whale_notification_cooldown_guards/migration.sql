-- CreateTable
CREATE TABLE "whale_notification_cooldown_guards" (
    "id" TEXT NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whale_notification_cooldown_guards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_whale_notify_cooldown_guard" ON "whale_notification_cooldown_guards"("dedup_key", "channel");

-- CreateIndex
CREATE INDEX "idx_whale_notify_cooldown_guard_expires" ON "whale_notification_cooldown_guards"("expires_at");
