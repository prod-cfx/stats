# React Doctor Formatter Array Hotspots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove issue #2610 React Doctor performance diagnostics for formatter construction, repeated array iterations, and immutable sorting in the listed `apps/front` production targets.

**Architecture:** Keep behavior local and observable: add a small front formatter cache utility, move repeated `Intl.NumberFormat` construction through that cache or module-level constants, replace copy-sort idioms with `toSorted()`, and combine only the flagged filter/map chains where order and predicates stay identical.

**Tech Stack:** Next.js front app, React 19, TypeScript 5.9, Jest unit tests, `dx` command wrapper.

---

## Files

- Create: `apps/front/src/lib/number-format-cache.ts`
- Create: `apps/front/src/lib/number-format-cache.test.ts`
- Modify: `apps/front/src/components/perf-issue-2610.test.ts`
- Modify formatter targets listed in #2610:
  - `apps/front/src/components/aggregated-orderbook/AggregatedOI.tsx`
  - `apps/front/src/components/aggregated-orderbook/AggregatedOrderbookView.tsx`
  - `apps/front/src/components/liquidation-data/LiquidationSummary.tsx`
  - `apps/front/src/components/trading/right-panel/RightPanel.tsx`
  - `apps/front/src/app/[lng]/long-short-ratio/LongShortRatioClient.tsx`
  - `apps/front/src/components/trading/left-trade-panel/LeftTradePanel.tsx`
  - `apps/front/src/components/liquidation-data/ExchangeLiquidationTable.tsx`
  - `apps/front/src/components/trading/top-bar/TopBar.tsx`
  - `apps/front/src/components/whale-tracking/discover/TraderCard.tsx`
  - `apps/front/src/features/dashboards/widgets/contents/LongShortRatioWidget.tsx`
  - `apps/front/src/components/trading/bottom-panel/BottomPanel.tsx`
- Modify repeated-iteration targets:
  - `apps/front/src/components/trading/center-chart-panel/CenterChartPanel.tsx`
  - `apps/front/src/components/ai-quant/DisplayLogicGraphPreview.tsx`
  - `apps/front/src/components/ai-quant/StrategyPlaza.tsx`
- Modify immutable sort targets:
  - `apps/front/src/components/whale-tracking/holdings/WhalePositionsTable.tsx`
  - `apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx`
  - `apps/front/src/components/public-companies/PublicCompaniesTable.tsx`
  - `apps/front/src/components/aggregated-orderbook/AggregatedVolume.tsx`
  - `apps/front/src/components/aggregated-orderbook/OrderbookTable.tsx`
  - `apps/front/src/components/aggregated-orderbook/DepthChart.tsx`
  - `apps/front/src/components/whale-tracking/discover/DiscoverGrid.tsx`

## Tasks

### Task 1: RED tests for formatter cache and issue hotspots

- [ ] Add `apps/front/src/lib/number-format-cache.test.ts` asserting same locale/options return same formatter instance, different locale/options return different instances, and formatted output matches `Intl.NumberFormat`.
- [ ] Add `apps/front/src/components/perf-issue-2610.test.ts` as a source-level guard for #2610 targets: no `new Intl.NumberFormat` remains in listed component files, no `[...x].sort(`/`.slice().sort(` remains in listed immutable-sort files, and no flagged `.filter().map()`/`.filter().filter()` chains remain in the listed repeated-iteration files.
- [ ] Run `dx test unit front apps/front/src/lib/number-format-cache.test.ts apps/front/src/components/perf-issue-2610.test.ts`; expected: fail because helper and cleanups do not exist yet.

### Task 2: GREEN formatter cache

- [ ] Create `apps/front/src/lib/number-format-cache.ts` exporting `getCachedNumberFormatter(locale, options)` and `formatWithCachedNumberFormatter(value, locale, options)`. Use stable JSON key with sorted option keys so equivalent options share cache entries.
- [ ] Replace `new Intl.NumberFormat` in #2610 formatter targets with `getCachedNumberFormatter` or `formatWithCachedNumberFormatter`. Preserve locale mapping and all options exactly.
- [ ] Run focused tests from Task 1; expected: formatter-cache assertions pass, remaining hotspot guard fails only for array items until Task 3.

### Task 3: GREEN array hotspots

- [ ] Replace immutable copies plus `.sort()` with `.toSorted()` in the #2610 immutable-sort targets. Preserve comparators exactly.
- [ ] Combine flagged repeated iteration chains in `CenterChartPanel`, `DisplayLogicGraphPreview`, and `StrategyPlaza` into one pass where this removes duplicate scans without changing output order.
- [ ] Run `dx test unit front apps/front/src/components/perf-issue-2610.test.ts apps/front/src/components/ai-quant/DisplayLogicGraphPreview.test.tsx apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx apps/front/src/components/aggregated-orderbook/AggregatedOrderbookView.markets.test.ts apps/front/src/components/whale-tracking/holdings/WhalePositionsTable.test.tsx apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.test.tsx`; expected: pass.

### Task 4: React Doctor and final verification

- [ ] Run `react-doctor apps/front --full --offline --json --fail-on none` and confirm #2610 files no longer report `js-hoist-intl`, `js-combine-iterations`, or `js-tosorted-immutable`; document any retained diagnostics with reason.
- [ ] Run required parallel gate: `dx lint`, `dx build front --dev`, and related `dx test unit front ...` scope. All must pass before commit.

## Verify

- `dx test unit front apps/front/src/lib/number-format-cache.test.ts apps/front/src/components/perf-issue-2610.test.ts`
- `dx test unit front apps/front/src/components/ai-quant/DisplayLogicGraphPreview.test.tsx apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx apps/front/src/components/aggregated-orderbook/AggregatedOrderbookView.markets.test.ts apps/front/src/components/whale-tracking/holdings/WhalePositionsTable.test.tsx apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.test.tsx`
- `react-doctor apps/front --full --offline --json --fail-on none`
- `dx lint`
- `dx build front --dev`
- `dx test unit front`

## Commit

Commit after all gates pass:

```bash
git add -A
git commit -F - <<'MSG'
perf: reduce front formatter and array hotspots

变更说明：
- 缓存前端 Intl.NumberFormat 实例，减少高频 render 中重复构造
- 合并 React Doctor 标记的数组遍历热点并改用 toSorted 表达不可变排序

Closes: #2610
MSG
```
