ALTER TABLE "ai_quant_conversations"
ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "idx_ai_quant_conversations_user_archived_updated_at"
ON "ai_quant_conversations"("user_id", "archived_at", "updated_at");
