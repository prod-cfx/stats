-- persist canonical compiler artifacts alongside published strategy snapshots
-- keep new compiled columns nullable so historical live-codegen rows remain readable

ALTER TABLE "llm_strategy_codegen_sessions"
ADD COLUMN "graph_snapshot" JSONB;

ALTER TABLE "published_strategy_snapshots"
ADD COLUMN "ir_hash" TEXT,
ADD COLUMN "ast_digest" TEXT,
ADD COLUMN "structural_digest" TEXT,
ADD COLUMN "ir_snapshot" JSONB,
ADD COLUMN "ast_snapshot" JSONB,
ADD COLUMN "compiled_manifest" JSONB,
ADD COLUMN "execution_envelope" JSONB;
