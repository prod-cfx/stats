# AI Quant Backtest Snapshot Projection Repair Design

- Date: 2026-04-13
- Status: Approved for spec drafting
- Scope: Fix AI Quant chat-session backtest gating by aligning session/conversation responses with the published snapshot truth model already used by quantify backtest execution.

## Problem Summary

Current AI Quant backtest behavior has a split truth boundary:

1. **Published snapshot storage is already formalized and sufficiently complete** for quantify to execute backtests from `publishedSnapshotId`.
2. **Quantify backtest execution is already correct in principle** because it reloads the authoritative published snapshot before running.
3. **AI Quant chat-session consumers are not fully aligned** because the session/conversation response projection does not reliably expose the full structured snapshot view that the frontend gating logic expects.

This creates a false-negative gating risk:

- The published snapshot in storage is valid for backtesting.
- The frontend chat page attempts to validate alignment before starting a backtest.
- The frontend depends on structured snapshot projection fields such as:
  - `publishedSnapshotStrategyConfig`
  - `publishedSnapshotBacktestConfigDefaults`
  - `publishedSnapshotDeploymentExecutionDefaults`
  - `publishedSnapshotDeploymentExecutionConstraints`
  - `publishedSnapshotCompatibilityMetadata`
- The response path appears to reliably provide only `publishedSnapshotId` and `publishedSnapshotParamValues`, with the richer formal fields not consistently projected.
- Result: the frontend may conservatively block a backtest even when the authoritative snapshot is complete.

## Why This Design Exists

The fix should preserve the existing dataflow contract:

`natural language -> confirmation -> publish -> publishedSnapshotId -> backtest/deploy`

The design must **not**:

- relax the frontend gate,
- invent defaults on the frontend,
- bypass `publishedSnapshotId`, or
- create a second source of truth for backtest semantics.

The design **must** make the session/conversation response layer reflect the same snapshot truth already used by quantify execution.

## Goals

1. Ensure AI Quant session and conversation responses expose a stable, structured published-snapshot view whenever a `publishedSnapshotId` is available.
2. Let the frontend gate continue to enforce alignment using formal snapshot data rather than inference.
3. Eliminate false blocking caused by incomplete response projection.
4. Preserve correct blocking for legacy or malformed snapshots via explicit compatibility metadata.
5. Keep the authoritative backtest execution path unchanged: quantify must continue loading the authoritative snapshot by `publishedSnapshotId`.

## Non-Goals

1. Do not change the published snapshot database schema.
2. Do not change quantify's backtest execution semantics.
3. Do not replace `publishedSnapshotId` with frontend-owned state.
4. Do not add a frontend-only fallback that guesses missing snapshot structure.
5. Do not add an extra “fetch snapshot details” round-trip as the primary solution.

## Chosen Approach

### Chosen Approach: System-level projection repair

Unify the session/conversation response model with the formal published snapshot truth model already stored in `published_strategy_snapshots`.

When a session or conversation response includes `publishedSnapshotId`, the backend should also project the structured snapshot truth fields needed by frontend gating and downstream UI hydration.

### Why this approach was chosen

This approach repairs the broken layer boundary directly:

- storage truth remains in published snapshots,
- quantify execution remains authoritative,
- frontend gating remains strict,
- response projection becomes truthful and complete.

### Alternatives considered

#### Alternative A: Relax or partially bypass frontend gating
Rejected because it weakens the consistency boundary between displayed strategy state and executed strategy state.

#### Alternative B: Frontend issues an extra request for full snapshot details
Rejected as the primary fix because it complicates hydration, introduces another request dependency, and leaves the response model internally inconsistent.

#### Alternative C: Frontend infers missing formal fields from `publishedSnapshotParamValues`
Rejected because it turns formal truth into frontend inference and is structurally fragile, especially for compatibility and deploy/backtest boundary fields.

## Target Data Model

Whenever `publishedSnapshotId` is present in AI Quant session/conversation responses, the response should also carry:

- `publishedSnapshotStrategyConfig`
- `publishedSnapshotBacktestConfigDefaults`
- `publishedSnapshotDeploymentExecutionDefaults`
- `publishedSnapshotDeploymentExecutionConstraints`
- `publishedSnapshotCompatibilityMetadata`
- `publishedSnapshotParamValues` (retained as a convenience / compatibility view)

### Field semantics

#### `publishedSnapshotId`
The authoritative published snapshot identifier used by backtest and deploy flows.

#### `publishedSnapshotStrategyConfig`
Structured strategy truth needed for frontend alignment and backtest preparation, including formal market information.

#### `publishedSnapshotBacktestConfigDefaults`
Structured backtest truth needed to construct backtest payloads without frontend guessing.

#### `publishedSnapshotDeploymentExecutionDefaults`
Structured deploy truth used by deploy gating and deploy configuration displays.

#### `publishedSnapshotDeploymentExecutionConstraints`
Structured deploy constraint truth used by leverage and execution gating.

#### `publishedSnapshotCompatibilityMetadata`
Explicit compatibility contract describing whether the snapshot is legacy or incomplete and whether republish is required for backtest and/or deploy.

#### `publishedSnapshotParamValues`
A convenience projection for display/recovery and compatibility. It is **not** the sole structured truth for backtest or deploy semantics.

## Source of Truth Rules

### Authoritative source
All structured snapshot projection fields must be derived from the authoritative `published_strategy_snapshots` row selected by `publishedSnapshotId` (or the latest published snapshot associated with the session where applicable).

### Disallowed derivation patterns
The response layer must not:

- reconstruct formal fields from frontend `paramValues`,
- infer full structure from `publishedSnapshotParamValues`,
- mix authoritative snapshot records with ad hoc session state when producing formal fields, or
- synthesize compatibility metadata on the frontend.

## Architecture Changes

## 1. Quantify response projection layer

Update quantify's codegen/session conversation response assembly so that published snapshot responses project the structured formal fields from the authoritative snapshot record.

### Primary surfaces
- `CodegenSessionResponseDto`
- `AiQuantConversationResponseDto`
- `CodegenConversationService.toSessionSnapshotResponse(...)`
- `CodegenConversationService.toConversationResponse(...)`

### Required behavior
When a latest/linked published snapshot exists:

- project the structured formal fields listed above,
- project compatibility metadata based on the actual snapshot record,
- continue to expose `publishedSnapshotId`,
- continue to expose `publishedSnapshotParamValues` for compatibility and UI hydration.

## 2. Backend proxy DTO preservation

Update backend proxy DTOs so they preserve the new fields end-to-end rather than dropping them.

### Primary surfaces
- backend proxy `CodegenSessionResponseDto`
- backend proxy `AiQuantConversationResponseDto`

### Required behavior
Proxy DTOs must be structurally aligned with quantify response payloads for published snapshot fields. The proxy layer should preserve, not reinterpret.

## 3. Frontend consumption model

Frontend AI Quant chat flows should treat the formal structured snapshot fields as the primary published-snapshot truth used for gating.

### Priority order
1. `publishedSnapshotStrategyConfig`
2. `publishedSnapshotBacktestConfigDefaults`
3. `publishedSnapshotCompatibilityMetadata`
4. `publishedSnapshotParamValues` only as an auxiliary compatibility/display view

### Required behavior
- Backtest gating should rely on formal structured fields, not inference.
- Existing strict gating should remain intact.
- `publishedSnapshotParamValues` should no longer act as the only formal source for backtest truth.

## Legacy Compatibility Strategy

Legacy snapshots or malformed snapshot projections must be handled explicitly, not silently repaired.

### Rules
If a published snapshot is missing formal fields such as:

- `strategyConfig`
- `backtestConfigDefaults`
- `deploymentExecutionDefaults`
- `deploymentExecutionConstraints`

then the response should:

- leave missing structured fields as `null`, and
- provide explicit compatibility metadata, including:
  - `isLegacySnapshot = true`
  - `requiresRepublishForBacktest = true` when backtest truth is incomplete
  - `requiresRepublishForDeploy = true` when deploy truth is incomplete

This preserves correct gating semantics:

- **new, complete snapshot** -> allow normal frontend gating and backtest construction
- **legacy/incomplete snapshot** -> block for a correct reason, not because response projection was accidentally incomplete

## Data Flow After the Fix

The repaired flow should be:

1. Publish pipeline writes a complete formal snapshot.
2. Session/conversation response reads and projects the formal snapshot.
3. Frontend hydrates AI Quant conversation state from that formal projection.
4. Frontend gate validates current editable state against formal snapshot truth.
5. Backtest request still sends `publishedSnapshotId`.
6. Quantify execution still reloads authoritative snapshot truth by `publishedSnapshotId`.

This keeps display truth, gate truth, and execution truth aligned.

## Error Handling

## Valid blocking
Valid blocking happens when the snapshot is actually unsuitable for the requested operation.

Examples:
- a legacy snapshot missing formal backtest fields,
- a snapshot marked as requiring republish,
- actual parameter drift between editable state and formal published snapshot truth.

## Invalid blocking to eliminate
Invalid blocking is when:

- the snapshot row is complete, but
- the session/conversation response fails to project the necessary formal fields, and
- the frontend blocks only because it did not receive them.

This design exists to eliminate that invalid-blocking class.

## Testing Strategy

## 1. Quantify response projection tests
Add or update tests to verify that when a session has a valid published snapshot, the session/conversation response includes:

- `publishedSnapshotId`
- `publishedSnapshotStrategyConfig`
- `publishedSnapshotBacktestConfigDefaults`
- `publishedSnapshotDeploymentExecutionDefaults`
- `publishedSnapshotDeploymentExecutionConstraints`
- `publishedSnapshotCompatibilityMetadata`
- `publishedSnapshotParamValues`

## 2. Legacy compatibility tests
Verify that incomplete snapshots do **not** receive fabricated formal fields and instead return explicit compatibility metadata indicating republish requirements.

## 3. Frontend chat-page gating tests
Verify the following:

### Case A: complete modern snapshot
Backtest gate passes into payload-building flow when no real drift exists.

### Case B: legacy/incomplete snapshot
Backtest gate blocks with an explicit republish-required interpretation.

### Case C: real editable-state drift
Backtest gate still blocks correctly when the editable state diverges from the formal published snapshot.

## 4. Regression tests
Verify no regression in:

- AI Quant conversation hydration,
- restored conversations,
- deploy gating displays,
- strategy detail page behavior,
- backtest execution semantics,
- account strategy detail hydration.

## Acceptance Criteria

1. For a complete modern published snapshot, AI Quant chat/session responses include the structured snapshot truth required by frontend gating.
2. AI Quant chat frontend no longer false-blocks backtests solely because structured snapshot projection fields are missing.
3. Legacy/incomplete snapshots still block, but with explicit compatibility metadata indicating republish requirements.
4. Quantify backtest execution continues to load authoritative snapshot truth from `publishedSnapshotId` without behavioral change.
5. Frontend no longer depends on `publishedSnapshotParamValues` as the sole published-snapshot truth for backtest gating.

## Risks

### Risk 1: response-model drift between quantify and backend proxy
Mitigation: update proxy DTOs in lockstep and add coverage that asserts the fields survive the proxy layer.

### Risk 2: frontend still implicitly prefers old fields
Mitigation: update gating/tests to make the formal structured fields primary and treat param-values projection as secondary.

### Risk 3: legacy snapshots become harder to use silently
Mitigation: this is intentional. The system should surface explicit republish requirements rather than guessing.

## Rollout Notes

This change is intended as a contract-alignment repair, not a product behavior redesign.

Operationally, the expected user-visible change is:

- fewer false “cannot backtest” outcomes in the AI Quant chat page for valid published strategies,
- clearer “republish required” behavior for older incomplete snapshots,
- no intentional change to actual quantify backtest semantics.

## Implementation Posture

Implement this as a narrow, truth-preserving contract repair:

- prefer extending existing response builders over introducing a second query model,
- avoid fallback inference from UI-owned state,
- preserve the published snapshot as the single authoritative source.

