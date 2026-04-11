ALTER TABLE "ai_quant_conversations"
ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "idx_ai_quant_conversations_user_archived_updated_at"
ON "ai_quant_conversations"("user_id", "archived_at", "updated_at");
