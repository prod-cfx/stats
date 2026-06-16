# React Doctor Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear current `apps/front` React Doctor Correctness and Dead Code diagnostics for issue #2582.

**Architecture:** Keep behavior and contracts unchanged. Replace index-derived React keys with stable content/business keys, change the `next/link` test mock to use normal anchor semantics without `preventDefault()`, and remove or de-export unused front-only API surface while preserving helpers used by `fetchTraderFullData()`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest, React Doctor, `dx` commands.

---

## Files

- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.test.tsx`
- Modify: `apps/front/src/components/account/UserAvatar.tsx`
- Modify: `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx`
- Modify: `apps/front/src/components/ai-quant/SemanticGraphValidationAlert.tsx`
- Modify: `apps/front/src/components/prediction-market/PredictionMarketGrid.tsx`
- Modify: `apps/front/src/components/whale-tracking/profile/ProfileDataTabs.tsx`
- Modify: `apps/front/src/features/dashboards/components/WidgetGroupPreview.tsx`
- Modify: `apps/front/src/lib/api.ts`
- Modify: `apps/front/src/lib/hyperliquid-api.ts`

## Steps

- [ ] Step 1: Baseline diagnostics.
  - Run: `react-doctor apps/front --full --offline --json --fail-on none > /tmp/react-doctor-front-before.json`.
  - If `react-doctor` is missing, install `react-doctor@0.1.6` in a temp dir with npm registry override and run its bin from repo root.
  - Record current Correctness/Dead Code count with `jq '[.projects[0].diagnostics[] | select(.category=="Correctness" or .category=="Dead Code")] | length' /tmp/react-doctor-front-before.json`.

- [ ] Step 2: RED checks for issue anchors.
  - Run `rg -n "key=\\{(index|idx|i)\\}|preventDefault\\(\\)|fetchTraderOpenOrdersFromHyperliquid|AccountAiQuantUpdateLeveragePayload" apps/front/src -g '!apps/front/public/tradingview/charting_library/**'` and confirm it still hits issue anchors.
  - Run `dx test unit front 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.test.tsx'` before edits; expected result is current test suite behavior, used as a regression baseline because React key diagnostics are static-analysis failures rather than missing runtime assertions.

- [ ] Step 3: Replace index-based keys.
  - In `BacktestReportClient.tsx`, key insight list by `insight`.
  - In `UserAvatar.tsx`, map identicon cells to `{ key: `${userId}-cell-${row}-${col}`, className }` before render.
  - In `AiQuantMarketingHome.tsx`, key title parts by `part === '' ? 'empty-part' : part`, reversion bars by named objects, and plaza bars by `bar.key`.
  - In `SemanticGraphValidationAlert.tsx`, key visible errors by `${error.code}-${error.message}`.
  - In `PredictionMarketGrid.tsx`, key outcomes by `${selectedPrediction.id}-option-${opt.label}` and rules by `${selectedPrediction.id}-rule-${p}`.
  - In `ProfileDataTabs.tsx`, key mobile spot/perp rows using the same business fields as desktop rows; key recent trades by timestamp/asset/action/value; key history rows by `order.id`.
  - In `WidgetGroupPreview.tsx`, replace placeholder arrays with objects containing stable `key` fields.

- [ ] Step 4: Fix test link semantics.
  - In `BacktestReportClient.test.tsx`, change mocked `next/link` to render `<a href={href} onClick={onClick}>{children}</a>` with no `event.preventDefault()` wrapper.

- [ ] Step 5: Remove dead exports only.
  - In `api.ts`, remove the unused `AccountAiQuantUpdateLeveragePayload` interface and stop re-exporting `TraderOpenOrdersResponse` from the central barrel.
  - In `hyperliquid-api.ts`, change `export type TraderOpenOrdersResponse` to private `type TraderOpenOrdersResponse`; change `fetchTraderOpenOrdersFromHyperliquid` to a private function if tests no longer require the export, or delete it if no internal caller remains. Keep `transformToTraderOpenOrders()` because `fetchTraderFullData()` uses it.

- [ ] Step 6: Verify static acceptance.
  - Run React Doctor again and confirm the Correctness/Dead Code query returns `0`.
  - Run the issue `rg` checks for key anchors and mocked link preventDefault.

- [ ] Step 7: Full verification.
  - Run in parallel: `dx lint`, `dx build front --dev`, `dx test unit front 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.test.tsx'`.
  - If any fail, fix root cause and rerun all three commands plus React Doctor.

- [ ] Step 8: Commit and PR.
  - Commit with `fix: clear front react-doctor correctness diagnostics` and `Refs: #2582`.
  - Push branch and create one PR against `main` with PR template sections and `Closes: #2582`, `Refs: #2581`.

## Verify

- `react-doctor apps/front --full --offline --json --fail-on none`
- `jq '[.projects[0].diagnostics[] | select(.category=="Correctness" or .category=="Dead Code")] | length' /tmp/react-doctor-front-report.json`
- `rg -n "key=\\{(index|idx|i)\\}" apps/front/src/app apps/front/src/components apps/front/src/features`
- `rg -n "preventDefault\\(\\)" 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.test.tsx'`
- `dx lint`
- `dx test unit front 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.test.tsx'`
- `dx build front --dev`

## Commit

`fix: clear front react-doctor correctness diagnostics`
