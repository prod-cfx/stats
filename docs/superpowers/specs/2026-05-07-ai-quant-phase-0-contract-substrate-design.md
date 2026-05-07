# AI Quant Phase 0 Contract Substrate Design

Date: 2026-05-07

Issue: #984

## Context

AI Quant already uses atomic semantic state as the main source of truth:

- `triggers`
- `actions`
- `risk`
- `position`
- `contextSlots`

Recent work added atom contracts, readiness normalization, combination trigger contracts, canonical IR coverage, and runtime parity tests. The next goal is broader live-trading coverage, but adding high-value atoms directly would keep stretching the current contract shape in different directions.

Phase 0 is the substrate switch before Phase 1-5 atom expansion. It must make contract completeness measurable and fail-closed, while keeping the model centered on atomic semantics instead of strategy-family templates.

The project is still in a testing stage, so this design intentionally does not preserve old contract fallback behavior. Current working single-strategy atomic semantics must continue to work, but they should do so by being migrated onto the new substrate, not by keeping legacy compatibility paths alive.

## Goals

1. Extend `SemanticAtomContract` with explicit runtime, state, order, and open-slot requirements.
2. Add a thin `SemanticOrchestrationContract` type boundary for future scope, gate, runtime program, and portfolio-risk semantics.
3. Make readiness fail closed for supported atoms that do not declare or satisfy the new substrate.
4. Create an atom coverage corpus baseline with route and coverage statistics.
5. Keep Phase 0 out of concrete Phase 1 runtime work such as `volume.threshold`, `atr_threshold`, or `partial_take_profit`.

## Non-Goals

- Do not implement new Phase 1 supported atoms.
- Do not connect orchestration to canonical spec, IR, script runtime, backtest, or live signal paths.
- Do not update Prisma, frontend, OpenAPI DTOs, or generated API contracts.
- Do not create legacy field mappers from display graph, family metadata, loose params, or old grouping fields into the new substrate.
- Do not use strategy families as readiness or compiler authority.

## Core Principle: No Compatibility Upgrade

Phase 0 is a contract substrate cutover, not a compatibility layer.

- All `supported_executable` and `supported_requires_slot` atoms must have explicit substrate fields: `runtimeRequirements`, `stateRequirements`, `orderRequirements`, and `openSlots`.
- Empty arrays are valid only when the contract has no requirement in that dimension; omitted fields are a schema gap for supported atoms.
- Existing single-strategy atoms that already work must be migrated to the new substrate.
- If an existing atom cannot be migrated safely in Phase 0, it should not remain silently deployable through an old path.
- New tests must prevent legacy loose fields from deciding readiness.

This is deliberately stricter than "never break old snapshots." The product is still in testing, and leaving compatibility branches would make later atom expansion harder to reason about.

## Design

### 1. Contract Types

Extend `SemanticAtomContract` in `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`:

```ts
interface SemanticAtomContract {
  id: string
  kind: SemanticContractKind
  capabilities: readonly SemanticCapability[]
  requires: readonly SemanticRequirement[]
  params: Record<string, unknown>
  effects?: readonly SemanticEffect[]
  runtimeRequirements: readonly SemanticRuntimeRequirement[]
  stateRequirements: readonly SemanticStateRequirement[]
  orderRequirements: readonly SemanticOrderRequirement[]
  openSlots: readonly SemanticSlotState[]
}
```

Add minimal requirement types:

- `SemanticRuntimeRequirement`: indicators, timeframes, data fields, and helpers needed before execution.
- `SemanticStateRequirement`: runtime state keys and read/write intent, such as remembered levels or sequence state.
- `SemanticOrderRequirement`: required order capability, such as market order, limit order, cancel order, reduce-only, or post-only.

The exact shape should stay small and structured around `domain / verb / object / shape`, matching the existing capability style where possible.

### 2. Thin Orchestration Boundary

Add optional orchestration state to `SemanticState`:

```ts
interface SemanticState {
  version: 1
  families: string[]
  triggers: SemanticTriggerState[]
  actions: SemanticActionState[]
  risk: SemanticRiskState[]
  position: SemanticPositionState | null
  contextSlots: SemanticContextSlotState
  orchestration?: SemanticOrchestrationState
  normalizationNotes: string[]
  updatedAt: string
  updatedTurnId?: string
  unsupportedFallback?: UnsupportedFallbackState | null
}
```

Define orchestration as a future execution boundary:

```ts
interface SemanticOrchestrationState {
  nodes: readonly SemanticOrchestrationNode[]
  contracts: readonly SemanticOrchestrationContract[]
}

interface SemanticOrchestrationContract {
  id: string
  kind: 'scope' | 'gate' | 'program' | 'portfolioRisk'
  capabilities: readonly SemanticCapability[]
  requires: readonly SemanticRequirement[]
  params: Record<string, unknown>
  openSlots: readonly SemanticSlotState[]
  effects?: readonly SemanticEffect[]
}

interface SemanticOrchestrationNode {
  id: string
  kind: 'scope' | 'gate' | 'program' | 'portfolioRisk'
  params: Record<string, unknown>
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: readonly SemanticSlotState[]
  contracts: readonly SemanticOrchestrationContract[]
}
```

Phase 0 only makes this serializable and testable. It must not make orchestration executable.

### 3. Readiness and Fail-Closed Rules

Update `SemanticContractReadinessService` so supported active owners are deployable only when their contracts satisfy the new substrate.

Readiness rules:

- `supported_executable` and `supported_requires_slot` owners must have contracts with all substrate arrays present.
- Contract `openSlots` merge into the owner open slots and block readiness when `affectsExecution=true`.
- Unsatisfied runtime, state, or order requirements block readiness.
- `recognized_unsupported` and `unsupported_unknown` owners remain fail-closed and must not become user-fillable open slots.
- A locked orchestration node blocks deployability in Phase 0 because orchestration has no runtime path yet.

There should be no fallback that infers substrate fields from old params, display graph metadata, family labels, or legacy grouping fields.

### 4. Coverage Corpus Baseline

Add a corpus fixture:

`apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`

Case shape:

```ts
interface AtomicContractCoverageCase {
  id: string
  title: string
  input: string
  tags: AtomicCoverageTag[]
  expectedRoute:
    | 'supported_executable'
    | 'supported_requires_slot'
    | 'recognized_unsupported'
    | 'unsupported_unknown'
  expectedAtoms: Array<{
    key: string
    category: 'trigger' | 'action' | 'risk' | 'position' | 'context' | 'orchestration'
    minContractSubstrate?: boolean
  }>
  notes?: string
}
```

Start with at least 50 representative cases across:

- trend following
- mean reversion
- breakout
- grid
- DCA
- add/reduce/reverse position
- multi-timeframe
- state memory
- partial take profit
- multi-leg
- event-driven strategies
- portfolio risk

Phase 0 corpus tests are contract coverage tests, not full natural-language extraction tests. They should verify registry/route/substrate expectations and establish a baseline for later coverage movement.

### 5. Testing

Add focused tests:

- `semantic-contract-readiness.service.spec.ts`
  - Supported atoms with complete substrate remain ready when all requirements are satisfied.
  - Supported atoms missing substrate arrays fail readiness.
  - Contract open slots merge into the owning atom and block readiness.
  - Unsatisfied runtime/state/order requirements fail closed.
  - Unsupported atoms do not become open-slot prompts.
  - Locked orchestration nodes are not deployable in Phase 0.

- `atomic-contract-coverage-corpus.spec.ts`
  - Corpus contains at least 50 cases.
  - Every case has route, tags, and expected atoms.
  - Every supported executable expected atom declares minimum substrate.
  - Orchestration or high-level execution-program cases are not counted as executable in Phase 0.
  - Coverage statistics are stable enough to serve as the Phase 1 baseline.

Suggested verification:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-coverage-corpus.spec.ts
dx build quantify --dev
```

## Risks

- The stricter substrate cutover may expose existing supported atoms that lack explicit runtime/order/state declarations. That is intended; those atoms should be migrated rather than bypassed.
- Readiness may initially block more cases than before. This is preferable to marking unsupported execution paths as deployable.
- Orchestration examples will remain non-executable until Phase 5. Corpus tags should make this visible instead of hiding it.

## Acceptance Criteria

- `SemanticAtomContract` requires explicit substrate arrays for supported atoms.
- `SemanticOrchestrationState` and `SemanticOrchestrationContract` are defined but not executable.
- Readiness fails closed for missing substrate and unsatisfied runtime/state/order requirements.
- Current working single-strategy atoms are represented through the new substrate, not through compatibility fallback.
- A 50+ case corpus establishes the baseline route and coverage statistics for Phase 1 and later.
