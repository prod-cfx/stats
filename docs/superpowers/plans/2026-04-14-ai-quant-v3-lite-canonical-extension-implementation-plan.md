# AI Quant V3-Lite Canonical Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten AI Quant v3-lite clarification and normalization so we can support more single-leg strategies and fixed-range grids, while keeping executable truth on the existing `canonical spec v2 -> IR -> AST -> compiled script -> publishedSnapshotId` path.

**Architecture:** Keep the current `clarification -> canonical spec v2 -> semantic view -> confirm -> IR -> AST -> compiled script -> publish` pipeline shape. Add a bounded normalization layer for first-wave atoms and grid semantics, but use normalized output only for gating and observation. State-related semantics are retained only as `observation_only` hints and do not enter semantic graph, IR, or runtime execution in this increment.

**Tech Stack:** NestJS, TypeScript, Jest, Swagger DTOs, Prisma-backed session/snapshot persistence, AI Quant compiler services under `apps/quantify/src/modules/llm-strategy-codegen`.

---

## Final Scope

This plan was originally drafted with a larger `state-gated execution` Task 5. During implementation, scope was intentionally tightened to the final approved direction:

1. Keep the main pipeline unchanged:
   `自然语言 -> clarification gate -> canonical spec v2 -> semantic view -> confirm canonical snapshot -> IR -> AST -> compiled script -> publish -> publishedSnapshotId -> backtest -> report -> deploy`
2. Use normalization for:
   - clarification and gating
   - semantic-view observation
   - unsupported-clause blocking
3. Do **not** compile `trend.direction / market.regime / volatility.state` into executable IR/runtime semantics
4. Preserve a future gray rollout exit via `stateHint` / `observation_only` metadata only

## Actual Deliverables

### Changed code areas

- `apps/quantify/src/modules/llm-strategy-codegen/types/strategy-normalized-intent.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-intent-normalizer.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-normalization-system.prompt.ts`
- clarification / question / planner / legacy codegen prompt files
- `codegen-conversation.service.ts`
- `spec-desc-builder.service.ts`
- `canonical-spec-builder.service.ts`
- `codegen-publication-generation.stage.ts`
- supporting type files and focused test files under `services/__tests__` and `prompts/__tests__`

### Supported in this increment

- More single-leg strategies
- Fixed-range grid normalization
- Unsupported-clause hard blocking
- Observation-only state hints in semantic view / normalized metadata
- Published snapshot and confirmation flow staying on executable canonical v2 truth

### Explicitly not implemented in this increment

- Executable state-gated strategies
- Runtime state predicates
- Sequence semantics
- Multi-leg execution

## Task Status

### Task 1: Introduce The V3-Lite Atom And Normalized Intent Contracts

Status: `Completed`

Implemented:

- Added `strategy-normalized-intent.ts`
- Added first-wave atom/family catalog in `canonical-strategy-capabilities.ts`
- Added `strategy-intent-normalizer.service.spec.ts`

Notes:

- Final contract keeps state-related semantics available for normalization metadata, but not for executable compilation.

### Task 2: Tighten Clarification And Prompt Contracts Around Atoms, Grid, And State Gates

Status: `Completed`

Implemented:

- Expanded checklist payload with `grid` and `stateGates`
- Added clarification reasons/fields for grid and state ambiguity
- Tightened clarification/question services
- Tightened planner prompt
- Added `strategy-normalization-system.prompt.ts`
- Reframed `strategy-codegen-system.prompt.ts` as debug/reference-only

Notes:

- State semantics remain clarification targets and observation hints only.

### Task 3: Implement The Normalization Service And Wire It Into Conversation Flow

Status: `Completed`

Implemented:

- Added `StrategyIntentNormalizerService`
- Wired normalization into `startSession`, `continueSession`, structured-clarification flow, and publication generation
- Blocked unsupported clauses instead of silently dropping them
- Preserved the existing executable canonical path for confirm/publish

Notes:

- Normalization is now strong enough to stop unsupported mixed clauses before confirmation.

### Task 4: Build Canonical V3-Lite Truth And Semantic View From Normalized Intent

Status: `Completed with narrowed scope`

Implemented:

- Added normalized metadata support to canonical spec types
- Added `buildFromNormalizedIntent(...)` support in `CanonicalSpecBuilderService`
- Added normalized-intent awareness in `SpecDescBuilderService`
- Semantic view now carries normalized intent and observation-only state hints

Final scope change:

- Executable confirmation/publish truth remains `canonicalSpecBuilder.build(checklist)`
- `buildFromNormalizedIntent(...)` is retained as an internal helper and metadata path, not the main published truth source

Reason:

- This preserves the confirmation/publish boundary and avoids semantic drift between what is shown and what is executed.

### Task 5: Compile Normalized Grid And State Gates Through Semantic Graph, IR, And Consistency

Status: `Canceled / replaced by safe-tightening decision`

Original intent:

- Compile state-gated grid semantics through semantic graph, IR, and runtime consistency

Final decision:

- Do not compile state gates into semantic graph / IR / runtime in this increment
- Keep state hints observation-only
- Roll back partial state-gated execution support to avoid publishing misleading semantics

What remains from this task:

- No executable state-gated graph/IR/runtime behavior ships in this branch
- Existing graph / IR / consistency path remains valid for the legacy executable scope

### Task 6: Persist Normalized Canonical Truth In Published Snapshots And Response DTOs

Status: `Completed with narrowed scope`

Implemented:

- Published generation stage now carries normalized observation data into semantic view/session spec description
- Response surfaces can expose normalized observation data

Final scope change:

- Published executable truth stays anchored to canonical spec v2 built from checklist
- Normalized output is persisted as observation/gating context, not as the executable canonical source

### Task 7: Run Focused Regression Verification For The First-Wave Strategy Set

Status: `Completed`

Executed verification:

- Focused llm-strategy-codegen unit suites
- TypeScript `noEmit`
- ESLint on changed core files
- `dx build quantify --dev`
- Targeted Quantify E2E for `llm-strategy-codegen`

## Verification Evidence

Completed and read:

- `pnpm exec tsc --noEmit --pretty false --project apps/quantify/tsconfig.json`
- `pnpm exec eslint` on changed core files under `apps/quantify/src/modules/llm-strategy-codegen/**`
- Focused Jest run across 13 test files:
  - `strategy-intent-normalizer.service.spec.ts`
  - `strategy-clarification-rules.service.spec.ts`
  - `strategy-clarification-question.service.spec.ts`
  - `conversation-planner-system-prompt.spec.ts`
  - `strategy-normalization-system-prompt.spec.ts`
  - `strategy-codegen-system-prompt.spec.ts`
  - `canonical-spec-builder.service.spec.ts`
  - `codegen-conversation.service.spec.ts`
  - `codegen-session-publication-pipeline.spec.ts`
  - `semantic-graph-builder.service.spec.ts`
  - `semantic-graph-validator.service.spec.ts`
  - `canonical-spec-v2-ir-compiler.service.spec.ts`
  - `strategy-consistency.service.spec.ts`
- Result: `13` suites passed, `203` tests passed
- `dx build quantify --dev`
- `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`
- Result: `5` E2E tests passed

Environment note:

- The targeted E2E run was executed with local root-backed configuration:
  - local PostgreSQL on `127.0.0.1:5432`
  - temporary local Redis on `127.0.0.1:6380`
- This was necessary because the default checked-in `.env.e2e` only contained placeholders.

## Changed Files Summary

- Clarification and prompt contracts:
  - `types/codegen-checklist.ts`
  - `types/strategy-clarification.ts`
  - `services/strategy-clarification-rules.service.ts`
  - `services/strategy-clarification-question.service.ts`
  - `prompts/conversation-planner-system.prompt.ts`
  - `prompts/strategy-normalization-system.prompt.ts`
  - `prompts/strategy-codegen-system.prompt.ts`

- Normalization and observation:
  - `types/strategy-normalized-intent.ts`
  - `services/strategy-intent-normalizer.service.ts`
  - `services/spec-desc-builder.service.ts`
  - `services/codegen-conversation.service.ts`
  - `services/codegen-publication-generation.stage.ts`

- Canonical metadata support:
  - `types/canonical-strategy-spec-v2.ts`
  - `services/canonical-spec-builder.service.ts`

- Tests:
  - focused `services/__tests__/*`
  - focused `prompts/__tests__/*`

## Remaining Risks

- `state-gated` terminology still exists in prompt/type/catalog metadata, but is now observation-only. Future work must avoid reconnecting it to execution without coordinated runtime/compiler/consistency support.
- This branch does not attempt full Quantify E2E coverage; it validates the most relevant `llm-strategy-codegen` E2E path only.

## Self-Review Checklist

- [x] Final implemented scope matches the user’s last decision: `安全收紧 + 灰度出口`
- [x] Main pipeline shape remains unchanged
- [x] Executable truth remains on canonical spec v2 -> IR -> AST -> compiled script -> published snapshot
- [x] Unsupported normalization clauses now block instead of being silently dropped
- [x] State-related semantics are observation-only and do not enter runtime execution
- [x] Typecheck passed
- [x] Lint passed on changed core files
- [x] Focused unit/integration tests passed
- [x] Targeted llm-strategy-codegen E2E passed
- [x] This document now reflects actual delivered scope instead of the superseded wider execution plan
