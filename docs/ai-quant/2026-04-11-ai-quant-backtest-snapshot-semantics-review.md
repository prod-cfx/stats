# AI Quant Snapshot-Bound Backtest Semantics Review

## Scope
- Plan anchors:
  - `.omx/plans/prd-2026-04-11-ai-quant-backtest-snapshot-semantics.md`
  - `.omx/plans/test-spec-2026-04-11-ai-quant-backtest-snapshot-semantics.md`
- Review posture: code-quality + integration-readiness review before the parallel implementation lands.
- Delivery note: after acceptance criteria pass on the integrated branch, the leader should run `$git-pr-ship`.

## Approved semantic summary
The approved plan chooses one stronger semantic boundary:
1. `publishedSnapshotId` stays authoritative for strategy truth.
2. Backtest execution parameters must also be snapshot-bound.
3. Chat page and strategy detail page must read the same snapshot-derived backtest configuration.
4. Published snapshots must not be blocked by a front-only `missing_explicit_execution_config` gate.
5. Terminal failure hydration must keep the real terminal outcome visible.

## Review findings

### Already aligned with the approved direction
1. **Quantify runtime already treats the published snapshot as strict backtest truth.**
   - `apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.ts`
   - `BacktestSnapshotLoaderService` loads `paramsSnapshot + lockedParams` from the published snapshot and rejects snapshots that do not provide strict params.
2. **Strategy detail already has a snapshot-bound data path.**
   - `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
   - `apps/quantify/src/modules/account-strategy-view/dto/account-strategy-detail.response.dto.ts`
   - The detail service resolves snapshot-bound `paramValues` from the bound snapshot, which is the right backend shape to reuse for detail/chat parity.

### Current mismatches that block the approved plan
1. **Chat conversation DTOs do not expose snapshot-bound backtest configuration.**
   - `apps/quantify/src/modules/llm-strategy-codegen/dto/ai-quant-conversation.response.dto.ts`
   - `apps/backend/src/modules/ai-quant-proxy/dto/ai-quant-conversation.response.dto.ts`
   - `apps/front/src/lib/api.ts`
   - Current response contracts include `publishedSnapshotId`, but no canonical snapshot-bound execution-config payload for chat hydration.
2. **Chat hydration rebuilds local state without a server-owned snapshot backtest contract.**
   - `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts`
   - `createConversationFromServerConversation()` maps published/terminal artifacts, but it does not receive or store snapshot-bound backtest execution parameters.
3. **The chat backtest submit path still enforces the stale front-only explicitness gate.**
   - `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts`
   - `buildInvalidExecutionConfigMessage()` still returns `missing_explicit_execution_config` whenever `backtestExecutionConfigExplicit !== true`, even for published snapshots.
4. **Detail and chat are still at risk of drift because the contract is not named/shared as one snapshot-backtest payload.**
   - `apps/front/src/components/account/ai-quant-strategy-api-adapter.ts`
   - `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`
   - Detail currently reuses `snapshot.paramValues`, which is directionally correct, but the front contract still treats those values as generic params instead of an explicit shared backtest-config payload.

## Recommended parallel write scope

### Lane 1 — core implementation (`worker-1`)
Keep writes inside the contract + runtime path that makes snapshot-bound backtest config first-class:
- `apps/quantify/src/modules/llm-strategy-codegen/**`
- `apps/backend/src/modules/ai-quant-proxy/**`
- `apps/front/src/lib/api.ts`
- `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts`
- `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts`
- `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`
- `apps/front/src/components/account/ai-quant-strategy-api-adapter.ts`

### Lane 2 — tests + verification (`worker-2`)
Keep writes inside focused regression coverage only:
- `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx`
- `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx`
- `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts`
- `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx`
- `apps/front/src/components/account/ai-quant-strategy-api-adapter.test.ts`
- relevant quantify/backend controller/service tests for DTO + snapshot-backtest mapping

### Lane 3 — review/docs (`worker-3`)
Keep writes documentation-only:
- `docs/ai-quant/2026-04-11-ai-quant-backtest-snapshot-semantics-review.md`

## Integration checklist
1. Quantify + backend + front API contracts expose one canonical snapshot-bound backtest-config payload for published snapshots.
2. Chat hydration consumes that payload directly instead of reconstructing implicit execution config from local-only state.
3. Detail page consumes the same payload shape or a mapper proven equivalent to the chat payload.
4. Published snapshots no longer fail with `missing_explicit_execution_config`.
5. Non-published sessions remain blocked with a clear error.
6. Hydrated terminal failures keep `CONSISTENCY_FAILED` / `REJECTED` outcome visibility.
7. Test coverage proves chat/detail parity and payload-display parity.

## Remaining risks to watch during integration
1. **Mapper drift risk** — if chat and detail each normalize snapshot params differently, the UI can still show one payload and submit another.
2. **Hydration overwrite risk** — terminal sessions can regress if new snapshot-bound fields overwrite failure-state presentation logic.
3. **Contract naming risk** — reusing generic `paramValues` without an explicit snapshot-backtest meaning may preserve ambiguity for future changes.
4. **Staging-only gap** — local tests can prove contract parity, but real staging smoke is still required to confirm reload/hydration behavior against persisted server conversations.

## Baseline verification on pre-change HEAD
This review was produced against commit `039413f5` (`Hydrate AI Quant terminal server conversations without hiding outcomes`).

Expected next verification on the integrated branch:
- front focused Jest around chat/detail backtest semantics
- quantify/backend focused Jest for DTO + snapshot loading
- typecheck for touched apps
- real staging smoke for published snapshot chat + reload + detail parity
