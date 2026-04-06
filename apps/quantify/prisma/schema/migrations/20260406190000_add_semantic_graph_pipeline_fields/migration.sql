-- persist semantic-graph pipeline artifacts for task 3
-- nullable columns keep historical rows readable

ALTER TABLE "llm_strategy_codegen_sessions"
ADD COLUMN "semantic_graph" JSONB,
ADD COLUMN "validation_report" JSONB,
ADD COLUMN "compiled_ir" JSONB;

ALTER TABLE "published_strategy_snapshots"
ADD COLUMN "semantic_graph" JSONB,
ADD COLUMN "compiled_ir" JSONB;
