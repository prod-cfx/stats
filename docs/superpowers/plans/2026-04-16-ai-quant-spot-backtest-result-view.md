# AI Quant Spot Backtest Result View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing AI Quant backtest result page render spot backtests with spot-native result semantics while preserving perp-specific result language.

**Architecture:** Keep the current backtest detail route and data-fetching pipeline, then add a dedicated `marketType`-aware presentation adapter between raw job/result payloads and the UI. The adapter will map summary labels, marker labels, symbol presentation, and open-position wording differently for `spot` versus `perp`, while the page shell and chart/result plumbing remain shared.

**Tech Stack:** Next.js/React/TypeScript, Jest, existing AI Quant front-end result page components/utilities

---

## File Structure

### Presentation adapter and page integration
- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/page.tsx` or the actual route entry if it delegates immediately
- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.tsx` (the current backtest result detail client component; inspect actual filename before edit)
- Create or modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.ts`
  - Single responsibility: convert raw job/result data into spot/perp-aware UI-facing view models.
- Modify: any local result-card / summary / marker presenter used by the backtest detail page if the existing page already decomposes those concerns.

### Types and formatting helpers
- Modify: `apps/front/src/lib/backtesting-api.ts`
  - Ensure job/result types expose `inputSummary.marketType` and nullable `inputSummary.leverage` for UI consumption.
- Modify: any existing local display helpers used by the backtest detail page, only if needed for symbol or marker formatting.

### Tests
- Create or modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts`
- Modify: result-page component tests if they already exist; otherwise create `apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.test.tsx`

---

### Task 1: Expose the raw market-type/backtest-summary inputs needed by the UI

**Files:**
- Modify: `apps/front/src/lib/backtesting-api.ts`
- Test: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts`

- [ ] **Step 1: Write the failing type/adapter contract test**

```ts
it('accepts spot job summaries with nullable leverage and explicit marketType', () => {
  const job = makeBacktestJob({
    inputSummary: {
      marketType: 'spot',
      leverage: null,
    },
  })

  const model = buildBacktestResultPresentationModel({
    job,
    result: makeBacktestResult(),
  })

  expect(model.marketType).toBe('spot')
})
```

- [ ] **Step 2: Run the adapter test and verify it fails**

Run: `pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts' --runInBand`

Expected: FAIL because the current front-end types do not yet guarantee `marketType`/nullable `leverage` in the result view path or the adapter file does not exist.

- [ ] **Step 3: Update the front-end raw backtest types**

```ts
// apps/front/src/lib/backtesting-api.ts
export interface BacktestJob {
  id: string
  status: BacktestJobPhase
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
  errorDetails?: {
    code?: string
    message: string
    args?: Record<string, unknown>
  }
  inputSummary?: {
    symbols: string[]
    baseTimeframe: string
    stateTimeframes: string[]
    initialCash: number
    leverage?: number | null
    marketType?: 'spot' | 'perp'
    dataRange: { fromTs: number; toTs: number }
    requestedRange: { fromTs: number; toTs: number }
    appliedRange?: { fromTs: number; toTs: number }
    allowPartial: boolean
    isPartial: boolean
    strategyId: string
  }
  resultSummary?: BacktestJobResult['summary']
}
```

- [ ] **Step 4: Re-run the adapter test and verify the raw type path is now unblocked**

Run: `pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts' --runInBand`

Expected: still FAIL only because the actual presentation adapter is not yet implemented.

- [ ] **Step 5: Commit the raw-type slice**

```bash
git add apps/front/src/lib/backtesting-api.ts
git commit -m "Expose market-aware backtest result inputs"
```

### Task 2: Build a dedicated spot/perp result presentation adapter

**Files:**
- Create: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.ts`
- Test: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts`

- [ ] **Step 1: Write the failing adapter tests for spot/perp label mapping**

```ts
it('maps spot summary fields into holding-oriented labels', () => {
  const model = buildBacktestResultPresentationModel({
    job: makeBacktestJob({
      inputSummary: {
        marketType: 'spot',
        leverage: null,
        symbols: ['BTCUSDT'],
      },
      resultSummary: {
        netProfit: 0,
        netProfitPct: 0,
        maxDrawdownPct: 0.31,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        totalOpenTrades: 1,
        openPnl: 3.73,
      },
    }),
    result: makeBacktestResult(),
  })

  expect(model.headerTag).toBe('现货回测')
  expect(model.summaryRows).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'completedTrades', label: '已完成交易', value: '0' }),
    expect.objectContaining({ key: 'currentHoldings', label: '当前持仓', value: '1' }),
    expect.objectContaining({ key: 'openPnl', label: '持仓浮盈浮亏', value: expect.stringContaining('3.73') }),
  ]))
})

it('keeps perp labels in futures-oriented wording', () => {
  const model = buildBacktestResultPresentationModel({
    job: makeBacktestJob({
      inputSummary: { marketType: 'perp', leverage: 3, symbols: ['BTCUSDT'] },
    }),
    result: makeBacktestResult(),
  })

  expect(model.headerTag).toBe('合约回测')
  expect(model.marketContext.showLeverage).toBe(true)
})

it('maps spot markers into buy/sell wording', () => {
  const model = buildBacktestResultPresentationModel({
    job: makeBacktestJob({ inputSummary: { marketType: 'spot', leverage: null, symbols: ['BTCUSDT'] } }),
    result: makeBacktestResult({
      markers: [
        { symbol: 'BTCUSDT:SPOT', ts: 1, price: 100, kind: 'entry_long', tradeId: 't1' },
        { symbol: 'BTCUSDT:SPOT', ts: 2, price: 110, kind: 'exit_long', tradeId: 't1' },
      ],
    }),
  })

  expect(model.markers[0]?.label).toBe('买入建仓')
  expect(model.markers[1]?.label).toBe('卖出平仓')
})
```

- [ ] **Step 2: Run the adapter test file and verify failure**

Run: `pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts' --runInBand`

Expected: FAIL because the adapter module and mappings do not yet exist.

- [ ] **Step 3: Implement the presentation adapter minimally**

```ts
// apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.ts
import type { BacktestJob, BacktestJobResult } from '@/lib/backtesting-api'

export interface BacktestResultPresentationModel {
  marketType: 'spot' | 'perp'
  headerTag: string
  symbolLabel: string
  marketContext: {
    showLeverage: boolean
    leverageLabel?: string
  }
  summaryRows: Array<{ key: string; label: string; value: string }>
  markers: Array<BacktestJobResult['markers'][number] & { label: string; displaySymbol: string }>
  openPositions: Array<BacktestJobResult['openPositions'][number] & {
    displaySymbol: string
    quantityLabel: string
    avgEntryLabel: string
    pnlLabel: string
  }>
}

function normalizeMarketType(job: BacktestJob): 'spot' | 'perp' {
  return job.inputSummary?.marketType === 'perp' ? 'perp' : 'spot'
}

function formatSymbolForDisplay(symbol: string, marketType: 'spot' | 'perp'): string {
  const normalized = symbol.replace(':SPOT', '').replace(':PERP', '')
  return marketType === 'spot' ? `${normalized} 现货` : `${normalized} 合约`
}

function markerLabel(kind: string, marketType: 'spot' | 'perp'): string {
  if (marketType === 'spot') {
    if (kind === 'entry_long') return '买入建仓'
    if (kind === 'exit_long') return '卖出平仓'
  }
  if (kind === 'entry_long') return '做多开仓'
  if (kind === 'exit_long') return '做多平仓'
  if (kind === 'entry_short') return '做空开仓'
  if (kind === 'exit_short') return '做空平仓'
  return kind
}

export function buildBacktestResultPresentationModel(args: {
  job: BacktestJob
  result: BacktestJobResult
}): BacktestResultPresentationModel {
  const marketType = normalizeMarketType(args.job)
  const summary = args.job.resultSummary ?? args.result.summary
  const primarySymbol = args.job.inputSummary?.symbols?.[0] ?? args.result.openPositions?.[0]?.symbol ?? ''

  const summaryRows = marketType === 'spot'
    ? [
        { key: 'netProfit', label: '净收益', value: String(summary.netProfit) },
        { key: 'netProfitPct', label: '收益率', value: String(summary.netProfitPct) },
        { key: 'maxDrawdownPct', label: '最大回撤', value: String(summary.maxDrawdownPct) },
        { key: 'completedTrades', label: '已完成交易', value: String(summary.totalTrades) },
        { key: 'currentHoldings', label: '当前持仓', value: String(summary.totalOpenTrades ?? 0) },
        { key: 'openPnl', label: '持仓浮盈浮亏', value: String(summary.openPnl ?? 0) },
      ]
    : [
        { key: 'netProfit', label: '净收益', value: String(summary.netProfit) },
        { key: 'netProfitPct', label: '收益率', value: String(summary.netProfitPct) },
        { key: 'maxDrawdownPct', label: '最大回撤', value: String(summary.maxDrawdownPct) },
        { key: 'totalTrades', label: '总交易数', value: String(summary.totalTrades) },
        { key: 'totalOpenTrades', label: '未平仓交易', value: String(summary.totalOpenTrades ?? 0) },
        { key: 'openPnl', label: '未平仓盈亏', value: String(summary.openPnl ?? 0) },
      ]

  return {
    marketType,
    headerTag: marketType === 'spot' ? '现货回测' : '合约回测',
    symbolLabel: formatSymbolForDisplay(primarySymbol, marketType),
    marketContext: {
      showLeverage: marketType === 'perp',
      leverageLabel: marketType === 'perp' && typeof args.job.inputSummary?.leverage === 'number'
        ? `${args.job.inputSummary.leverage}x`
        : undefined,
    },
    summaryRows,
    markers: (args.result.markers ?? []).map(marker => ({
      ...marker,
      label: markerLabel(marker.kind, marketType),
      displaySymbol: formatSymbolForDisplay(marker.symbol, marketType),
    })),
    openPositions: (args.result.openPositions ?? []).map(position => ({
      ...position,
      displaySymbol: formatSymbolForDisplay(position.symbol, marketType),
      quantityLabel: marketType === 'spot' ? '当前持仓数量' : '仓位数量',
      avgEntryLabel: marketType === 'spot' ? '持仓均价' : '开仓均价',
      pnlLabel: marketType === 'spot' ? '持仓浮盈浮亏' : '未平仓盈亏',
    })),
  }
}
```

- [ ] **Step 4: Re-run the adapter tests and verify pass**

Run: `pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts' --runInBand`

Expected: PASS; spot/perp summary and marker mappings are correct.

- [ ] **Step 5: Commit the adapter slice**

```bash
git add apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.ts \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts
git commit -m "Add market-aware backtest result presentation adapter"
```

### Task 3: Wire the result page to the new presentation model

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.test.tsx`

- [ ] **Step 1: Write the failing page rendering tests**

```tsx
it('renders spot result page with spot-specific summary labels', async () => {
  render(<BacktestResultPageClient initialJob={makeBacktestJob({
    inputSummary: { marketType: 'spot', leverage: null, symbols: ['BTCUSDT'] },
  })} initialResult={makeBacktestResult({
    summary: {
      netProfit: 0,
      netProfitPct: 0,
      maxDrawdownPct: 0.31,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      totalOpenTrades: 1,
      openPnl: 3.73,
    },
  })} />)

  expect(screen.getByText('现货回测')).toBeInTheDocument()
  expect(screen.getByText('当前持仓')).toBeInTheDocument()
  expect(screen.getByText('持仓浮盈浮亏')).toBeInTheDocument()
  expect(screen.queryByText('杠杆')).not.toBeInTheDocument()
})

it('renders perp result page with leverage and futures labels', async () => {
  render(<BacktestResultPageClient initialJob={makeBacktestJob({
    inputSummary: { marketType: 'perp', leverage: 3, symbols: ['BTCUSDT'] },
  })} initialResult={makeBacktestResult()} />)

  expect(screen.getByText('合约回测')).toBeInTheDocument()
  expect(screen.getByText('杠杆')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the result-page component tests and verify failure**

Run: `pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.test.tsx' --runInBand`

Expected: FAIL because the page still renders raw futures-oriented labels.

- [ ] **Step 3: Replace direct raw-field rendering with the adapter output**

```tsx
// apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.tsx
const presentation = buildBacktestResultPresentationModel({
  job,
  result,
})

return (
  <section>
    <header>
      <span>{presentation.headerTag}</span>
      <h1>{presentation.symbolLabel}</h1>
      {presentation.marketContext.showLeverage && presentation.marketContext.leverageLabel ? (
        <p>杠杆：{presentation.marketContext.leverageLabel}</p>
      ) : null}
    </header>

    <SummaryGrid rows={presentation.summaryRows} />
    <MarkerList markers={presentation.markers} />
    <OpenPositionList positions={presentation.openPositions} />
  </section>
)
```

- [ ] **Step 4: Re-run the page component tests and verify pass**

Run: `pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.test.tsx' --runInBand`

Expected: PASS; spot/perp page rendering now branches correctly.

- [ ] **Step 5: Commit the page-integration slice**

```bash
git add apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.tsx \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.test.tsx
git commit -m "Render backtest detail with market-specific semantics"
```

### Task 4: Add safe fallbacks and regression-proof symbol/open-position presentation

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.ts`
- Test: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts`

- [ ] **Step 1: Write the failing fallback tests**

```ts
it('falls back safely when marketType is missing', () => {
  const model = buildBacktestResultPresentationModel({
    job: makeBacktestJob({ inputSummary: { symbols: ['BTCUSDT'] } as any }),
    result: makeBacktestResult(),
  })

  expect(model.marketType).toBe('spot')
  expect(model.headerTag).toBe('现货回测')
})

it('formats spot open positions with holding labels', () => {
  const model = buildBacktestResultPresentationModel({
    job: makeBacktestJob({ inputSummary: { marketType: 'spot', symbols: ['BTCUSDT'] } }),
    result: makeBacktestResult({
      openPositions: [{ symbol: 'BTCUSDT:SPOT', qty: 1, avgEntryPrice: 100, unrealizedPnl: 5 }],
    }),
  })

  expect(model.openPositions[0]?.displaySymbol).toBe('BTCUSDT 现货')
  expect(model.openPositions[0]?.quantityLabel).toBe('当前持仓数量')
  expect(model.openPositions[0]?.avgEntryLabel).toBe('持仓均价')
  expect(model.openPositions[0]?.pnlLabel).toBe('持仓浮盈浮亏')
})
```

- [ ] **Step 2: Run the adapter tests again and verify failure**

Run: `pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts' --runInBand`

Expected: FAIL until the fallback and open-position display behavior is implemented.

- [ ] **Step 3: Add the safe fallback and open-position formatting**

```ts
// apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.ts
function normalizeMarketType(job: BacktestJob): 'spot' | 'perp' {
  return job.inputSummary?.marketType === 'perp' ? 'perp' : 'spot'
}

function formatSymbolForDisplay(symbol: string, marketType: 'spot' | 'perp'): string {
  const normalized = symbol.replace(':SPOT', '').replace(':PERP', '')
  return marketType === 'spot' ? `${normalized} 现货` : `${normalized} 合约`
}
```

- [ ] **Step 4: Re-run the adapter tests and verify pass**

Run: `pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath 'apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts' --runInBand`

Expected: PASS; fallback behavior and open-position formatting are stable.

- [ ] **Step 5: Commit the fallback-hardening slice**

```bash
git add apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.ts \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts
git commit -m "Harden spot backtest result display fallbacks"
```

### Task 5: Run verification on the final result-page implementation

**Files:**
- Verify all touched front-end result-page files from Tasks 1-4

- [ ] **Step 1: Run the full targeted result-page/front regression suite**

Run:

```bash
pnpm exec jest --config apps/front/jest.config.ts \
  --runTestsByPath \
  'apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts' \
  'apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.test.tsx' \
  'apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx' \
  --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run front type-check**

Run: `pnpm --dir apps/front type-check`

Expected: PASS.

- [ ] **Step 3: Run changed-file ESLint**

Run:

```bash
pnpm exec eslint \
  apps/front/src/lib/backtesting-api.ts \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.ts \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.tsx \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.test.tsx \
  --config eslint.config.js
```

Expected: PASS or only unchanged pre-existing test warnings.

- [ ] **Step 4: Run an affected build for front confidence**

Run: `dx build affected --dev`

Expected: PASS.

- [ ] **Step 5: Commit any final verification-driven adjustments**

```bash
git add apps/front/src/lib/backtesting-api.ts \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.ts \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-result-presentation.test.ts \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.tsx \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/<result-page-client>.test.tsx
git commit -m "Finalize spot backtest result view verification"
```

---

## Self-Review

### Spec coverage
- One shared result page instead of separate routes: covered by Task 3.
- Spot/perp header context split: covered by Tasks 2 and 3.
- Spot summary semantics (`已完成交易` / `当前持仓` / `持仓浮盈浮亏`): covered by Task 2 and Task 3.
- Marker wording split (`买入建仓` / `卖出平仓` for spot): covered by Task 2.
- Open-position and symbol display for spot: covered by Task 4.
- Perp semantics preserved: covered by Tasks 2 and 3.
- Verification of rendering + type safety: covered by Task 5.

### Placeholder scan
- All tasks contain explicit file paths, code snippets, commands, and expected results.
- No `TODO`, `TBD`, or “same as above” instructions remain.
- The one intentional placeholder `<result-page-client>` must be resolved by inspecting the actual route component filename before implementation starts; this is a bounded lookup, not an open placeholder for behavior.

### Type consistency
- `marketType` consistently normalizes to `'spot' | 'perp'`, defaulting to `spot` for safe fallback.
- Spot summary labels and open-position labels remain presentation-only; raw data fields are not renamed.
- The adapter is the only layer responsible for converting raw result fields into spot/perp wording.
