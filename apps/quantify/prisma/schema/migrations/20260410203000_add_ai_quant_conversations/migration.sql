DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'AiQuantConversationMessageRole'
  ) THEN
    CREATE TYPE "AiQuantConversationMessageRole" AS ENUM ('user', 'assistant');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ai_quant_conversations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "codegen_session_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_quant_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_quant_conversations_codegen_session_id_fkey"
    FOREIGN KEY ("codegen_session_id")
    REFERENCES "llm_strategy_codegen_sessions"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ai_quant_conversation_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" "AiQuantConversationMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_quant_conversation_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_quant_conversation_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id")
    REFERENCES "ai_quant_conversations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_quant_conversations_codegen_session_id_key"
  ON "ai_quant_conversations"("codegen_session_id");

CREATE INDEX IF NOT EXISTS "idx_ai_quant_conversations_user_updated_at"
  ON "ai_quant_conversations"("user_id", "updated_at");

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_ai_quant_conversation_messages_conversation_sort_order"
  ON "ai_quant_conversation_messages"("conversation_id", "sort_order");

CREATE INDEX IF NOT EXISTS "idx_ai_quant_conversation_messages_conversation_created_at"
  ON "ai_quant_conversation_messages"("conversation_id", "created_at");
