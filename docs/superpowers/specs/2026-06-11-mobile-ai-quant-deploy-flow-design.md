# Mobile AI Quant Deploy Flow Design

Issue: #2427
Date: 2026-06-11

## Background

`apps/front` already runs the AI Quant flow against staging backend contracts. The observed flow is:

1. Start or continue an LLM strategy codegen session.
2. Clarify missing execution context such as symbol and market type.
3. Stop at `CONFIRM_GATE` and show the canonical strategy logic.
4. Confirm code generation with `confirmGenerate: true` and `confirmedCanonicalDigest`.
5. Wait for `PUBLISHED` and a `publishedSnapshotId`.
6. Run a backtest using that published snapshot.
7. Deploy with an exchange account and poll deploy result.

`apps/quantify-mobile` already has a mobile-shaped flow: AI chat, confirm page, script page, backtest config/run/result pages, and deploy sheet. It also already wires parts of `packages/api-contracts-dart`. The problem is not missing backend capability. The problem is that mobile still has some old mock-shaped and flat-field assumptions in data mapping and display, so the full deploy submission flow is fragile.

## Goal

Make mobile successfully submit an AI Quant strategy deployment through existing backend contracts, without backend changes and without changing front behavior.

Mobile should only display the data its existing screens need. It does not need to match every front detail or metric.

## Non-Goals

- Do not modify `apps/backend` or `apps/quantify` APIs.
- Do not regenerate or redesign front AI Quant.
- Do not rebuild mobile into the front page model.
- Do not add a new multi-step product flow beyond the existing mobile pages and sheet.
- Do not display all front-only strategy, graph, trade, or risk details.

## Current Contracts

### Codegen

- `POST /llm-strategy-codegen/sessions`
- `POST /llm-strategy-codegen/sessions/:id/messages`
- `GET /llm-strategy-codegen/sessions/:id`

Important response fields:

- `id`
- `conversationId`
- `status`
- `canonicalDigest`
- `specDesc`
- `semanticGraph`
- `scriptCode`
- `publishedSnapshotId`
- `publishedSnapshotParamValues`
- `publishedSnapshotStrategyConfig`
- `publishedSnapshotBacktestConfigDefaults`
- `publishedSnapshotDeploymentExecutionDefaults`
- `publishedSnapshotDeploymentExecutionConstraints`
- `publishedSnapshotCompatibilityMetadata`
- `strategyInstanceId`

### Backtest

- `POST /backtesting/symbols/check`
- `POST /backtesting/jobs`
- `GET /backtesting/jobs/:id`
- `GET /backtesting/jobs/:id/result`

Important request fields:

- `symbols`
- `baseTimeframe`
- `stateTimeframes`
- `initialCash`
- `leverage`
- `conversationId`
- `execution`
- `strategy.id`
- `strategy.protocolVersion`
- `strategy.publishedSnapshotId`
- `strategy.params.marketType`
- `dataRange`
- `requestedRangeInput`
- `sessionId`

Important result fields for mobile:

- `summary.netProfitPct`
- `summary.maxDrawdownPct`
- `summary.winRate`
- `summary.totalTrades`
- `summary.profitFactor`
- `equityCurve`
- `trades`

### Deploy

- `POST /account/ai-quant/strategies/deploy`
- `GET /account/ai-quant/strategies/deploy-requests/:deployRequestId/result`

Deploy request body uses `AccountAiQuantDeployRequestDto`:

- `name`
- `deployRequestId`
- `publishedSnapshotId`
- `exchangeAccountId`
- `exchangeAccountName`
- `deploymentExecutionConfig`

## Design

### 1. Keep Mobile Flow Shape

Keep the existing mobile flow:

AI chat -> `/ai/confirm` -> `/ai/script` -> `/ai/backtest-config` -> `/ai/backtest-run` -> `/ai/backtest-result` -> `/ai/deploy`.

The mobile UX remains compact. Data can be summarized. The backend contract, not front UI layout, is the source of truth.

### 2. Codegen Session Is the Strategy Truth

`AiPublishedStrategyContext` remains the object passed between confirm, script, backtest, and deploy steps.

It should read truth from these sources, in priority order:

1. Published snapshot fields.
2. `specDesc` and nested `executionContext`.
3. Existing route params only as fallback.

Derived fields should include:

- `exchange`, normalized to values like `okx`.
- `symbol`, normalized for API use and display.
- `baseTimeframe`.
- `marketType`, normalized to `spot` or `perp`.
- `leverage` when present.
- deployment defaults and constraints.

If `publishedSnapshotId` is missing after confirmation, block the next step with a clear error.

### 3. Confirm Page Uses Real Strategy Logic First

`AiConfirmPage` should render real codegen data when present:

- Use `specDesc.displayLogicGraph.blocks` for IF/THEN rule display.
- Use `specDesc.executionContext` for EXECUTE chips.
- Use snapshot params or rule action text for position and risk summary.

Fallback behavior stays available for deep links and old tests, but real session data must win over hardcoded BTC/ETH scenario templates.

For the example prompt, the confirm page should be able to show:

- Entry: 15m price above EMA20, EMA60, and EMA144 -> open long.
- Exit: 15m price below EMA20 -> close long.
- Risk: 5% stop loss.
- Position: 10 USDT.
- Exchange: OKX.
- Symbol: BTCUSDT after clarification.
- Market: perpetual.

### 4. Confirmation Waits for Published Snapshot

The confirm CTA should call `confirmStrategy` with:

- `message`: the current mobile confirmation message.
- `confirmGenerate: true` in the repository layer.
- `confirmedCanonicalDigest` from args or loaded session.

Then it should handle backend states:

- `CONFIRM_GATE`: retry confirmation a small bounded number of times.
- `GENERATING` and validation states: poll `GET /llm-strategy-codegen/sessions/:id`.
- `PUBLISHED`: proceed only if `publishedSnapshotId` exists.
- `CONSISTENCY_FAILED` or `REJECTED`: show reject reason.

### 5. Backtest Uses Published Snapshot and Polls Job State

`ApiBacktestRepository.run` should submit a real backtest job using the published snapshot. The run page should treat job creation as asynchronous:

- Submit job.
- Poll `GET /backtesting/jobs/:id` until `succeeded` or failed terminal status.
- Fetch `GET /backtesting/jobs/:id/result` for final data.

The result parser should accept the real backend shape:

- `summary.netProfitPct` -> `BacktestResult.totalReturnPercent`.
- `summary.maxDrawdownPct` -> `BacktestResult.maxDrawdownPercent`.
- `summary.winRate` -> `BacktestResult.winRatePercent`.
- `summary.totalTrades` -> `BacktestResult.totalTrades`.
- `equityCurve[].equity` -> chart values.
- `trades` when present -> mobile trade rows.

If a field is absent, mobile should show its existing empty state or zero fallback, not fail the whole flow.

### 6. Deploy Uses Existing Dart Contract

`ApiAiChatRepository.markDeployed` should prefer `AccountAiQuantApi.accountAiQuantStrategiesControllerDeploy` from `packages/api-contracts-dart`.

Deploy request rules:

- `deployRequestId` must be generated once per click and remain stable during retry/poll.
- `publishedSnapshotId` comes from `DeploymentContext`.
- `exchangeAccountId` and `exchangeAccountName` come from the selected exchange account.
- `deploymentExecutionConfig` carries only existing supported values, such as leverage and account override.

The deploy sheet should match accounts by the strategy exchange, such as OKX for the requested flow. If no matching account exists, keep the existing API binding entry.

After deploy submit, poll deploy result with a bounded loop. If the result stays pending, show processing state instead of spinning forever.

## Error Handling

- Missing `codegenSessionId`: ask the user to return to AI chat.
- Missing `confirmedCanonicalDigest` at confirm time: allow server attempt only if loaded session provides it; otherwise show an actionable error.
- Published session without `publishedSnapshotId`: block backtest.
- Published snapshot marked `requiresRepublishForBacktest`: block backtest and ask to reconfirm.
- Published snapshot marked `requiresRepublishForDeploy`: block deploy.
- Backtest symbol unsupported or market data unavailable: display backend error in mobile error text.
- Backtest job timeout or failed status: stop polling and show error.
- No exchange account for target exchange: show existing configure API action.
- Deploy result pending after poll limit: show "deployment processing" state.

## Tests

Focused tests should cover the changed contracts and UI mapping:

- `test/data/api_ai_chat_repository_test.dart`
  - `confirmStrategy` sends `confirmGenerate: true` and digest.
  - Codegen session parser preserves nested `specDesc.executionContext` and published snapshot fields.
  - Deploy through generated `AccountAiQuantApi` sends `AccountAiQuantDeployRequestDto` fields.

- `test/data/api_backtest_repository_test.dart`
  - Parses real `summary.netProfitPct`, `maxDrawdownPct`, `winRate`, `totalTrades`.
  - Parses equity curve rows with `{ ts, equity }`.

- `test/pages/ai_confirm_page_test.dart`
  - Real `displayLogicGraph` overrides fallback BTC/ETH templates.
  - EXECUTE block shows OKX, BTCUSDT, 15m, perpetual, and position/risk if present.
  - Confirm CTA waits for `PUBLISHED` and passes `AiPublishedStrategyContext` forward.

- `test/pages/ai_backtest_result_page_test.dart` or existing result widget tests
  - Result page keeps `AiPublishedStrategyContext` and builds `DeploymentContext` for deploy.

- `test/widgets/qz_deploy_sheet_test.dart`
  - For an OKX strategy, only OKX accounts are eligible.
  - Deploy call includes selected account and published snapshot.

## Acceptance

- A user can use mobile AI chat to generate a strategy.
- The confirm page can submit the real confirmation and receive a published snapshot.
- The backtest can run against the published snapshot and show mobile core metrics.
- The deploy sheet can submit the real deploy request with a selected exchange account.
- No backend API changes are required.
- Front behavior remains untouched.

