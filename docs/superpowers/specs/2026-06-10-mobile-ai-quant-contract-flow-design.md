# Mobile AI Quant Contract Flow Design

## Context

Mobile AI quant already has pages for chat, strategy confirmation, script preview, backtest configuration, backtest execution, and deployment. The current flow still passes many values as route strings and falls back to mock script or default deployment assumptions. Staging front uses the backend LLM codegen session, published snapshot, backtest, and deploy contracts as the source of truth.

## Goal

Connect the mobile AI quant flow to the real backend contract from strategy confirmation through deployment, without changing backend APIs or front behavior. Mobile should only surface data needed by the app UI.

## Design

Add a lightweight mobile AI published-strategy context that is built from `CodegenSessionResponseDto` and carried through the wizard:

`AI Chat -> Confirm Strategy -> Script -> Backtest Config -> Backtest Run -> Deploy`

The context will include the published snapshot id, codegen session id, strategy instance id, script code, snapshot param values, strategy config, backtest defaults, deployment defaults, deployment constraints, compatibility metadata, and display params used by existing mobile cards.

## Data Flow

- Chat creates and continues codegen sessions via `packages/api-contracts-dart` generated LLM codegen API.
- Confirm sends `confirmGenerate=true` plus `confirmedCanonicalDigest`, then polls until `PUBLISHED` or terminal failure.
- Script page renders `scriptCode` from the published response. Deep links without context keep a safe fallback.
- Backtest config derives defaults from `publishedSnapshotBacktestConfigDefaults` and `publishedSnapshotStrategyConfig` where present.
- Backtest run requires `publishedSnapshotId` and submits the existing backtest repository request with snapshot binding.
- Deploy receives `DeploymentContext`, filters accounts by the strategy exchange when available, and submits `publishedSnapshotId`, `exchangeAccountId`, `exchangeAccountName`, and deployment execution config.

## Error Handling

- Missing `publishedSnapshotId` blocks backtest and deploy locally with a user-visible message.
- `CONSISTENCY_FAILED` and `REJECTED` stop the confirm flow and show the backend reject reason.
- Compatibility metadata requiring republish blocks backtest or deploy instead of sending stale requests.
- Missing exchange account keeps the existing configure-API path.

## Testing

- Repository tests cover codegen confirm metadata, deployment request payload, and backtest snapshot guard.
- Widget/router tests cover context propagation into script, backtest, and deploy pages.
- Script page tests verify real `scriptCode` display and fallback behavior.
- Deploy tests verify account filtering and deployment context payload.

## Scope

In scope: `apps/quantify-mobile` and tests, using existing `packages/api-contracts-dart` generated models/APIs.

Out of scope: backend changes, front changes, regenerating contracts unless existing generated contract is insufficient.
