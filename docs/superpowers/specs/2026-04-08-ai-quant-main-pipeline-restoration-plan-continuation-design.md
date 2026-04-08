# AI Quant Main Pipeline Restoration Plan Continuation Design

Date: 2026-04-08
Context: continue the original implementation plan after partial completion on `codex/ai-quant-main-pipeline-restoration`

## Background

The original restoration work already completed the canonical digest confirmation contract and the frontend confirmation migration, and it partially restored the compiler spine on the Quantify side.

However, the original implementation plan has not reached its intended terminal state yet:

- `Task 1` is complete
- `Task 3` is complete
- `Task 2` is only partially complete
- `Task 4` is only partially complete

The remaining work must therefore continue the original plan rather than replace it with a new, smaller plan.

## Goal

Continue the existing implementation plan until the original target pipeline is actually true end to end:

`natural language -> clarification gate -> canonical spec v2 -> semantic view -> confirm canonical snapshot -> IR -> AST -> compiled script -> publish -> publishedSnapshotId -> backtest(using publishedSnapshotId) -> report -> deploy(using publishedSnapshotId, gated by report)`

## Core Decision

The original implementation plan at [2026-04-07-ai-quant-main-pipeline-restoration-implementation-plan.md](/Users/zengmengdan/coinfulx-new/stats/.worktrees/ai-quant-main-pipeline-restoration/docs/superpowers/plans/2026-04-07-ai-quant-main-pipeline-restoration-implementation-plan.md) should be updated in place.

It should not be replaced by a new follow-up plan file.

Reason:

- the user explicitly wants the remaining work of the existing plan to be completed
- the original task structure still matches the intended architecture
- the missing work is best understood as unfinished portions of `Task 2`, `Task 4`, and the final verification sweep

## Status Model For The Updated Plan

The updated implementation plan should preserve the original task numbering but make state explicit:

- `Task 1`: complete
- `Task 2`: partially complete, remaining steps must be rewritten
- `Task 3`: complete
- `Task 4`: partially complete, remaining steps must be rewritten
- `Final Verification Sweep`: not complete

The rewritten plan should distinguish clearly between:

- already completed steps that are retained only for traceability
- remaining steps that still require execution

## Continuation Scope

### Included

- rewriting the unfinished portions of `Task 2`
- rewriting the unfinished portions of `Task 4`
- rewriting the final verification section so it matches the actual remaining work
- preserving the original plan goal and task numbering

### Excluded

- rewriting completed `Task 1` and `Task 3` as if they were still pending
- creating a brand new implementation plan file
- redefining the architecture to match the current partial implementation instead of the intended end state

## Task 2 Continuation Design

`Task 2` must be continued until the compiler publication path reaches the original plan's publication boundary, not merely until compiled artifacts exist somewhere in the flow.

### Current Partial State

The current branch already:

- compiles `canonical spec v2 -> IR -> AST -> compiled script`
- routes publish through `CompiledPublicationGateService`
- persists compiler artifacts during publication

But the task is still incomplete because:

- `CodegenConversationService` still preserves an older pre-publish script generation and validation path before compilation
- `CompiledPublicationGateService` still persists `graphSnapshot` as `specSnapshot`
- publication does not yet model the canonical snapshot and semantic view as first-class publication truth
- semantic consistency and compiler consistency are not yet merged into the publication contract in the way the original plan intended

### Required End State

The rewritten remaining steps for `Task 2` must require:

1. `CompiledPublicationGateService` accepts and persists:
   - canonical snapshot
   - semantic view
   - graph snapshot
   - IR
   - AST
   - compiled manifest
   - compiled script
   - merged consistency report
2. publication stops treating `graphSnapshot` as the authoritative `specSnapshot`
3. tests assert publication content correctness, not only publication success
4. remaining `CodegenConversationService` assertions are updated so the live publish path is judged against the original publication-boundary design

### Important Constraint

This continuation does not need to re-scope completed work, but it must still treat `Task 2` as unfinished until the publication truth boundary matches the original architectural intent.

## Task 4 Continuation Design

`Task 4` must be continued until runtime-facing proxy behavior is fully aligned with `publishedSnapshotId` as the only deploy/backtest truth boundary.

### Current Partial State

The current branch already:

- forwards `confirmedCanonicalDigest` through the backend proxy continuation path

But `Task 4` remains incomplete because:

- deploy proxy DTOs still use the old explicit strategy fields
- deploy controller/service forwarding still does not pass `publishedSnapshotId`
- the remaining backend proxy tests do not yet prove deploy forwarding through `publishedSnapshotId`

### Required End State

The rewritten remaining steps for `Task 4` must require:

1. backend deploy DTO adds `publishedSnapshotId`
2. backend deploy controller forwards `publishedSnapshotId`
3. backend deploy proxy tests assert `publishedSnapshotId` forwarding
4. existing Quantify runtime strictness tests for deploy/backtest are re-run to prove runtime truth still comes only from `publishedSnapshotId`

## Final Verification Design

The final verification section should be rewritten as a true completion gate rather than a generic regression reminder.

It must prove all three contract layers are aligned:

### Quantify

- canonical digest tests
- compiler bridge tests
- compiled publication gate tests
- conversation publish-path tests
- deploy/backtest runtime strictness tests

### Frontend

- canonical digest confirmation tests

### Backend Proxy

- continue-session digest forwarding tests
- deploy snapshot forwarding tests

## Success Criteria

The original implementation plan may only be considered complete when all of the following are true:

- the plan file explicitly marks completed versus unfinished work accurately
- `Task 2` reaches the original publication-boundary end state
- `Task 4` reaches deploy/runtime proxy end-to-end closure
- the final verification suite proves there is no remaining live dependency on the old `semanticGraph -> validationReport` contract for confirmation or runtime truth

## Plan Update Strategy

The original implementation plan should be edited with the following structure:

1. annotate completed tasks and completed steps
2. retain completed content for traceability
3. replace stale pending steps in `Task 2`, `Task 4`, and `Final Verification Sweep`
4. keep commands concrete and bounded to the remaining work only

This keeps the original plan readable while making it executable from the current branch state.
