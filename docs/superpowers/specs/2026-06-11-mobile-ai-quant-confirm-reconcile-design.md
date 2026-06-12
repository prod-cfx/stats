# Mobile AI Quant Confirm Reconcile Design

## Background

Flutter mobile AI Quant can enter `/ai/confirm` from a conversation that already has a codegen session. Today the confirm page always sends `confirmGenerate=true` when the user taps `下一步：策略脚本`. If the session already published a script, or if a publish/backtest-like task is still in progress, this repeats work and can surface `409 CONFLICT`.

Front avoids this by reconciling the active codegen session before confirm. It can reuse a published snapshot, wait for processing, recover after terminal conflicts, or restart when local and remote state no longer match.

## Goal

Make mobile submit the deploy flow reliably without backend changes. The confirm step must preserve generated scripts and published snapshots, avoid duplicate script generation, and recover from transient `409` conflicts when the backend session already contains usable artifacts.

## Scope

- Only `apps/quantify-mobile` changes.
- Use existing backend contracts from `packages/api-contracts-dart` through the current repository layer.
- Do not change backend APIs.
- Do not expand mobile display scope beyond current confirm/script/backtest/deploy pages.

## Design

### Confirm Preflight

When `/ai/confirm` has `codegenSessionId`, tapping `下一步：策略脚本` first calls `getCodegenSession(sessionId)`.

- If status is `PUBLISHED` and `publishedSnapshotId` is present, open `/ai/script` with `AiPublishedStrategyContext.fromCodegen(snapshot)`.
- If status is processing (`GENERATING`, `VALIDATING_*`), poll `getCodegenSession` until `PUBLISHED`, terminal failure, or timeout. Do not send another `confirmGenerate=true` while the session is already processing.
- If status is `CONFIRM_GATE`, send `confirmStrategy` with the best known canonical digest, then reuse the existing publish polling.
- If status is terminal failure, show the existing inline error.

### Conflict Recovery

If `confirmStrategy` throws `ApiException(statusCode: 409)`:

- Call `getCodegenSession(sessionId)`.
- If that snapshot is `PUBLISHED`, open `/ai/script` and keep the generated `scriptCode` / `publishedSnapshotId`.
- If it is processing, poll until completion.
- Otherwise show the normalized API error.

This mirrors front's recover-first behavior without adding mobile-only backend endpoints.

### Digest Safety

Mobile should not blindly reuse a remote session when local confirmation carries a canonical digest and the remote session carries a different non-empty digest.

- If local digest and remote digest both exist and differ, show an inline message asking the user to return to chat and regenerate/confirm the latest strategy.
- If one side lacks a digest, prefer backend state because `publishedSnapshotId` and `scriptCode` are backend truth.

### Existing Published Session

If a user generated a strategy script, left the flow, and returns to confirm, mobile should skip regeneration and enter script preview directly from the published context.

### Tests

Add focused widget tests for:

- Published preflight opens script without calling `confirmStrategy`.
- Processing preflight polls and opens script without calling `confirmStrategy`.
- `409` from confirm recovers by fetching the published session.
- Digest mismatch blocks reuse and shows an inline error.

## Out Of Scope

- Backend conflict semantics.
- Front behavior changes.
- New generated Dart contract generation.
- Full redesign of mobile AI chat session creation UI.
