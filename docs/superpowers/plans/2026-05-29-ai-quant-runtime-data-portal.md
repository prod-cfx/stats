# AI Quant Runtime Data Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rules-only backtest and live execution support complex strategies through one snapshot-truth, point-in-time runtime data path.

**Architecture:** P0 removes the bad compiler mapping from ordinary market binding to `scope.dataSource`. P1 adds a derived runtime data plan and shared point-in-time context assembly so backtest and live resolve secondary market data with the same closed-bar `asOf(primaryCloseTs)` semantics.

**Tech Stack:** TypeScript, NestJS 11, Jest, `@ai/shared` compiled runtime, Quantify backtesting and strategy-signals modules.

---

## File Structure

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts`
  - Remove the fallback that converts `contextSlots.exchange` into `scope.dataSource`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/dispatcher-self-baseline.spec.ts`
  - Add P0 regression coverage for ordinary exchange context.
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.ts`
  - Pure types and helpers for primary clock, market series, indicator requirements, external feeds, and event streams.
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.resolver.ts`
  - Pure resolver that derives market-series requirements from snapshot params, existing `stateTimeframes`, script metadata, and compiled orchestration scopes.
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-portal.ts`
  - Pure point-in-time helpers for closed-bar `asOf` lookup and script bar projection.
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-context-assembler.ts`
  - Builds the normalized compiled-runtime context used by backtest and live.
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.spec.ts`
  - Unit tests for the 15m/1h/4h EMA20 data plan and `scope.dataSource` separation.
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts`
  - Unit tests for closed-bar `asOf` behavior.
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts`
  - Use runtime data plan when building script context.
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts`
  - Add P1 backtest acceptance for the 15m/1h/4h EMA20 context.
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-market-data.service.ts`
  - Load data from derived runtime plan instead of trusting frontend `stateTimeframes`.
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-market-data.service.spec.ts`
  - Prove frontend `stateTimeframes` cannot drop snapshot/script-derived requirements.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts`
  - Route live context creation through shared assembler.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`
  - Pass current live bars and snapshot-derived plan into the assembler.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generator-orchestration-portfolio-risk.spec.ts`
  - Add live-context acceptance for the 15m/1h/4h EMA20 plan.

## Task 1: P0 Compiler Regression Test

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/dispatcher-self-baseline.spec.ts`

- [ ] **Step 1: Add failing regression test**

Add this test near the other dispatcher baseline tests that inspect emitted atom keys:

```ts
it('does not convert ordinary exchange context into scope.dataSource', () => {
  const dispatcher = createDispatcherForTest()
  const result = dispatcher.dispatch({
    userMessage: '在币安交易所 BTCUSDT 永续 15m，价格突破 EMA20 买入',
    flatPatch: {
      contextSlots: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '15m',
      },
    },
  })

  const atomKeys = result
    .filter(item => item.kind === 'atom')
    .map(item => item.key)

  expect(atomKeys).toContain('scope.symbol')
  expect(atomKeys).toContain('scope.timeframe')
  expect(atomKeys).not.toContain('scope.dataSource')
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/dispatcher-self-baseline.spec.ts -t "does not convert ordinary exchange context into scope.dataSource"
```

Expected: FAIL because `scope.dataSource` is currently emitted from `contextSlots.exchange`.

- [ ] **Step 3: Commit failing test**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/dispatcher-self-baseline.spec.ts
git commit -F - <<'MSG'
test(ai-quant): lock ordinary exchange out of dataSource scope

Refs: #runtime-data-portal
MSG
```

## Task 2: P0 Compiler Fix

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts`

- [ ] **Step 1: Remove exchange-to-dataSource emission**

Delete this block from `generic-seed-dispatcher.service.ts`:

```ts
const exchangeEvidence = this.findEvidenceText(userMessage, this.escapeRegexText(contextSlots.exchange))
if (typeof contextSlots.exchange === 'string' && contextSlots.exchange.trim().length > 0) {
  pushAtom({
    key: ATOM_CONTRACT_REGISTRY['scope.dataSource'].key,
    params: {
      dataSourceRole: 'primary',
      dataSourceFeedId: contextSlots.exchange,
      dataSourceSchemaRef: 'ohlcv',
    },
    ...(exchangeEvidence ? { evidence: { text: exchangeEvidence } } : {}),
  })
}
```

Leave `scope.symbol` and `scope.timeframe` emission unchanged.

- [ ] **Step 2: Run P0 regression**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/dispatcher-self-baseline.spec.ts -t "does not convert ordinary exchange context into scope.dataSource"
```

Expected: PASS.

- [ ] **Step 3: Run explicit datasource coverage**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/orchestration-data-source-scope-golden-corpus.spec.ts
```

Expected: existing explicit datasource behavior still PASS or the file remains skipped by its current `describe.skip` contract.

- [ ] **Step 4: Commit P0 fix**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts
git commit -F - <<'MSG'
fix(ai-quant): keep exchange context out of dataSource scope

Refs: #runtime-data-portal
MSG
```

## Task 3: Runtime Data Plan Types and Resolver Tests

**Files:**
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.ts`
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.resolver.ts`
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.spec.ts`

- [ ] **Step 1: Write runtime data plan type file**

Create `runtime-data-plan.ts`:

```ts
import type { MarketTimeframe } from '@ai/shared'

export interface RuntimePrimaryClock {
  exchange: string
  symbol: string
  marketType: 'spot' | 'perp'
  timeframe: MarketTimeframe
}

export interface RuntimeMarketSeriesRequirement {
  exchange: string
  symbol: string
  marketType: 'spot' | 'perp'
  timeframe: MarketTimeframe
}

export interface RuntimeIndicatorRequirement {
  indicator: 'ema'
  period: number
  timeframe: MarketTimeframe
}

export interface RuntimeExternalDataSourceRequirement {
  role: string
  feedId: string
  schemaRef: string
}

export interface RuntimeEventStreamRequirement {
  sourceRef: string
}

export interface RuntimeDataPlan {
  primaryClock: RuntimePrimaryClock
  marketSeries: RuntimeMarketSeriesRequirement[]
  indicators: RuntimeIndicatorRequirement[]
  externalDataSources: RuntimeExternalDataSourceRequirement[]
  eventStreams: RuntimeEventStreamRequirement[]
}

export function uniqTimeframes(timeframes: MarketTimeframe[]): MarketTimeframe[] {
  return Array.from(new Set(timeframes))
}
```

- [ ] **Step 2: Write failing resolver tests**

Create `runtime-data-plan.spec.ts`:

```ts
import { resolveRuntimeDataPlan } from './runtime-data-plan.resolver'

describe('resolveRuntimeDataPlan', () => {
  it('derives 15m primary clock plus 1h and 4h secondary series for EMA20 example', () => {
    const plan = resolveRuntimeDataPlan({
      strictParams: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
      },
      stateTimeframes: ['1h', '4h'],
      scriptMetadata: {
        indicators: [
          { indicator: 'ema', period: 20, timeframe: '15m' },
          { indicator: 'ema', period: 20, timeframe: '1h' },
          { indicator: 'ema', period: 20, timeframe: '4h' },
        ],
      },
      orchestrationScopes: [],
    })

    expect(plan.primaryClock).toEqual({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
    })
    expect(plan.marketSeries.map(item => item.timeframe)).toEqual(['15m', '1h', '4h'])
    expect(plan.indicators).toEqual([
      { indicator: 'ema', period: 20, timeframe: '15m' },
      { indicator: 'ema', period: 20, timeframe: '1h' },
      { indicator: 'ema', period: 20, timeframe: '4h' },
    ])
  })

  it('keeps explicit dataSource scopes separate from normal market series', () => {
    const plan = resolveRuntimeDataPlan({
      strictParams: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
      },
      stateTimeframes: [],
      scriptMetadata: {},
      orchestrationScopes: [
        {
          id: 'event-feed',
          scopeKind: 'dataSource',
          role: 'event',
          feedId: 'webhook.tradingview.alert',
          schemaRef: 'webhook_event',
        },
      ],
    })

    expect(plan.marketSeries.map(item => item.timeframe)).toEqual(['15m'])
    expect(plan.externalDataSources).toEqual([
      { role: 'event', feedId: 'webhook.tradingview.alert', schemaRef: 'webhook_event' },
    ])
  })
})
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-runtime/runtime-data-plan.spec.ts
```

Expected: FAIL because `resolveRuntimeDataPlan` does not exist yet.

## Task 4: Runtime Data Plan Resolver Implementation

**Files:**
- Modify: `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.resolver.ts`
- Test: `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.spec.ts`

- [ ] **Step 1: Implement resolver**

Create `runtime-data-plan.resolver.ts`:

```ts
import type { MarketTimeframe } from '@ai/shared'
import type {
  RuntimeDataPlan,
  RuntimeExternalDataSourceRequirement,
  RuntimeIndicatorRequirement,
  RuntimePrimaryClock,
} from './runtime-data-plan'
import { uniqTimeframes } from './runtime-data-plan'

interface ResolveRuntimeDataPlanInput {
  strictParams: {
    exchange: string
    symbol: string
    marketType: 'spot' | 'perp'
    baseTimeframe: MarketTimeframe
  }
  stateTimeframes: MarketTimeframe[]
  scriptMetadata?: Record<string, unknown>
  orchestrationScopes?: Array<Record<string, unknown>>
}

function readIndicators(metadata: Record<string, unknown> | undefined): RuntimeIndicatorRequirement[] {
  const raw = metadata?.indicators
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): RuntimeIndicatorRequirement[] => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Record<string, unknown>
    if (candidate.indicator !== 'ema') return []
    if (typeof candidate.period !== 'number' || !Number.isFinite(candidate.period) || candidate.period <= 0) return []
    if (typeof candidate.timeframe !== 'string' || candidate.timeframe.trim() === '') return []
    return [{ indicator: 'ema', period: candidate.period, timeframe: candidate.timeframe as MarketTimeframe }]
  })
}

function readExternalDataSources(scopes: Array<Record<string, unknown>> | undefined): RuntimeExternalDataSourceRequirement[] {
  return (scopes ?? []).flatMap((scope): RuntimeExternalDataSourceRequirement[] => {
    if (scope.scopeKind !== 'dataSource') return []
    const role = typeof scope.role === 'string' ? scope.role.trim() : ''
    const feedId = typeof scope.feedId === 'string' ? scope.feedId.trim() : ''
    const schemaRef = typeof scope.schemaRef === 'string' ? scope.schemaRef.trim() : ''
    if (!role || !feedId || !schemaRef) return []
    return [{ role, feedId, schemaRef }]
  })
}

export function resolveRuntimeDataPlan(input: ResolveRuntimeDataPlanInput): RuntimeDataPlan {
  const primaryClock: RuntimePrimaryClock = {
    exchange: input.strictParams.exchange,
    symbol: input.strictParams.symbol,
    marketType: input.strictParams.marketType,
    timeframe: input.strictParams.baseTimeframe,
  }
  const indicators = readIndicators(input.scriptMetadata)
  const requiredTimeframes = uniqTimeframes([
    input.strictParams.baseTimeframe,
    ...input.stateTimeframes,
    ...indicators.map(item => item.timeframe),
  ])

  return {
    primaryClock,
    marketSeries: requiredTimeframes.map(timeframe => ({
      exchange: input.strictParams.exchange,
      symbol: input.strictParams.symbol,
      marketType: input.strictParams.marketType,
      timeframe,
    })),
    indicators,
    externalDataSources: readExternalDataSources(input.orchestrationScopes),
    eventStreams: [],
  }
}
```

- [ ] **Step 2: Run resolver tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-runtime/runtime-data-plan.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit resolver**

```bash
git add apps/quantify/src/modules/strategy-runtime/runtime-data-plan.ts apps/quantify/src/modules/strategy-runtime/runtime-data-plan.resolver.ts apps/quantify/src/modules/strategy-runtime/runtime-data-plan.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): add runtime data plan resolver

Refs: #runtime-data-portal
MSG
```

## Task 5: Runtime Data Portal Closed-Bar Tests

**Files:**
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-portal.ts`
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts`

- [ ] **Step 1: Write failing closed-bar tests**

Create `runtime-data-portal.spec.ts`:

```ts
import { getClosedBarsAsOf } from './runtime-data-portal'

describe('getClosedBarsAsOf', () => {
  const bars = [
    { symbol: 'BTCUSDT', timeframe: '1h', openTime: 0, closeTime: 3_600_000, open: 100, high: 110, low: 90, close: 105, volume: 10 },
    { symbol: 'BTCUSDT', timeframe: '1h', openTime: 3_600_000, closeTime: 7_200_000, open: 105, high: 115, low: 95, close: 108, volume: 12 },
  ]

  it('does not expose an unfinished higher-timeframe bar before close', () => {
    expect(getClosedBarsAsOf(bars, 5_400_000).map(bar => bar.closeTime)).toEqual([3_600_000])
  })

  it('exposes the higher-timeframe bar once close time is reached', () => {
    expect(getClosedBarsAsOf(bars, 7_200_000).map(bar => bar.closeTime)).toEqual([3_600_000, 7_200_000])
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts
```

Expected: FAIL because `getClosedBarsAsOf` does not exist yet.

## Task 6: Runtime Data Portal Implementation

**Files:**
- Modify: `apps/quantify/src/modules/strategy-runtime/runtime-data-portal.ts`
- Test: `apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts`

- [ ] **Step 1: Implement closed-bar helper**

Create `runtime-data-portal.ts`:

```ts
import type { Bar } from '@/modules/backtesting/types/backtesting.types'

export interface RuntimeScriptBar {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export function getClosedBarsAsOf<T extends { closeTime: number }>(bars: readonly T[], ts: number): T[] {
  return bars.filter(bar => bar.closeTime <= ts)
}

export function toRuntimeScriptBars(bars: readonly Bar[]): RuntimeScriptBar[] {
  return bars.map(bar => ({
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    timestamp: bar.closeTime,
  }))
}
```

- [ ] **Step 2: Run portal tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit portal**

```bash
git add apps/quantify/src/modules/strategy-runtime/runtime-data-portal.ts apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): add closed-bar runtime data portal helpers

Refs: #runtime-data-portal
MSG
```

## Task 7: Shared Runtime Context Assembler

**Files:**
- Create: `apps/quantify/src/modules/strategy-runtime/runtime-context-assembler.ts`
- Test: `apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts`

- [ ] **Step 1: Add assembler test**

Append this test to `runtime-data-portal.spec.ts`:

```ts
import { buildRuntimeMarketContext } from './runtime-context-assembler'

it('assembles primary and secondary series by primary close timestamp', () => {
  const context = buildRuntimeMarketContext({
    symbol: 'BTCUSDT',
    baseTimeframe: '15m',
    primaryCloseTs: 5_400_000,
    params: { marketType: 'perp' },
    barsByTimeframe: {
      '15m': [
        { symbol: 'BTCUSDT', timeframe: '15m', openTime: 4_500_000, closeTime: 5_400_000, open: 100, high: 111, low: 99, close: 110, volume: 1 },
      ],
      '1h': [
        { symbol: 'BTCUSDT', timeframe: '1h', openTime: 0, closeTime: 3_600_000, open: 100, high: 110, low: 90, close: 105, volume: 10 },
        { symbol: 'BTCUSDT', timeframe: '1h', openTime: 3_600_000, closeTime: 7_200_000, open: 105, high: 115, low: 95, close: 108, volume: 12 },
      ],
    },
  })

  expect(context.data.primary['15m'].bars.map(bar => bar.timestamp)).toEqual([5_400_000])
  expect(context.data.primary['1h'].bars.map(bar => bar.timestamp)).toEqual([3_600_000])
  expect(context.execution.timeframe).toBe('15m')
})
```

- [ ] **Step 2: Implement assembler**

Create `runtime-context-assembler.ts`:

```ts
import type { MarketTimeframe } from '@ai/shared'
import type { Bar } from '@/modules/backtesting/types/backtesting.types'
import { getClosedBarsAsOf, toRuntimeScriptBars } from './runtime-data-portal'

export interface BuildRuntimeMarketContextInput {
  symbol: string
  baseTimeframe: MarketTimeframe
  primaryCloseTs: number
  params: Record<string, unknown>
  barsByTimeframe: Record<string, Bar[]>
}

export function buildRuntimeMarketContext(input: BuildRuntimeMarketContextInput) {
  const primaryLegId = 'primary'
  const dataForPrimary: Record<string, { bars: ReturnType<typeof toRuntimeScriptBars>, indicators: Record<string, number>, currentPrice: number }> = {}

  for (const [timeframe, bars] of Object.entries(input.barsByTimeframe)) {
    const closedBars = getClosedBarsAsOf(bars, input.primaryCloseTs)
    if (closedBars.length === 0) continue
    dataForPrimary[timeframe] = {
      bars: toRuntimeScriptBars(closedBars),
      indicators: {},
      currentPrice: closedBars[closedBars.length - 1]!.close,
    }
  }

  return {
    data: { [primaryLegId]: dataForPrimary },
    execution: { timeframe: input.baseTimeframe },
    legs: [{ id: primaryLegId, symbol: input.symbol, role: 'primary' }],
    dataRequirements: { [primaryLegId]: Object.keys(dataForPrimary) },
    timestamp: input.primaryCloseTs,
    params: input.params,
  }
}
```

- [ ] **Step 3: Run assembler tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit assembler**

```bash
git add apps/quantify/src/modules/strategy-runtime/runtime-context-assembler.ts apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): assemble runtime market context as of primary close

Refs: #runtime-data-portal
MSG
```

## Task 8: Backtest Integration for Derived Timeframes

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts`

- [ ] **Step 1: Add backtest acceptance test**

Add a focused unit test to `backtest-runner.service.spec.ts` that builds bars for `15m`, `1h`, and `4h`, runs one strategy function, and records the runtime context:

```ts
it('uses 15m as primary clock and exposes closed 1h and 4h series for EMA acceptance strategy', async () => {
  const seen: Array<{ ts: number, timeframes: string[], oneHourLastTs?: number, fourHourLastTs?: number }> = []
  const input = createRunInput({
    baseTimeframe: '15m',
    stateTimeframes: ['1h', '4h'],
    bars: [
      bar('BTCUSDT', '1h', 0, 3_600_000, 105),
      bar('BTCUSDT', '4h', 0, 14_400_000, 100),
      bar('BTCUSDT', '15m', 4_500_000, 5_400_000, 110),
      bar('BTCUSDT', '15m', 14_400_000, 15_300_000, 120),
    ],
    strategy: {
      fn: (ctx) => {
        const data = (ctx as { data?: Record<string, Record<string, { bars: Array<{ timestamp: number }> }>> }).data?.primary ?? {}
        seen.push({
          ts: ctx.ts,
          timeframes: Object.keys(data).sort(),
          oneHourLastTs: data['1h']?.bars.at(-1)?.timestamp,
          fourHourLastTs: data['4h']?.bars.at(-1)?.timestamp,
        })
        return { type: 'NOOP', reason: 'acceptance' }
      },
    },
  })

  await runner.run(input)

  expect(seen[0]).toEqual({
    ts: 5_400_000,
    timeframes: ['15m', '1h'],
    oneHourLastTs: 3_600_000,
    fourHourLastTs: undefined,
  })
  expect(seen[1]).toEqual({
    ts: 15_300_000,
    timeframes: ['15m', '1h', '4h'],
    oneHourLastTs: 3_600_000,
    fourHourLastTs: 14_400_000,
  })
})
```

- [ ] **Step 2: Run test and verify failure or current gap**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts -t "uses 15m as primary clock"
```

Expected before integration: FAIL if context assembly exposes unfinished or missing secondary data.

- [ ] **Step 3: Integrate assembler in `buildScriptContext`**

In `backtest-runner.service.ts`, replace the local `dataForPrimary` construction in `buildScriptContext` with a call to `buildRuntimeMarketContext`. Build `barsByTimeframe` from `historyBarsBySymbolTimeframe`, passing raw bars for each requested timeframe:

```ts
const requestedTimeframes = Array.from(new Set([input.input.baseTimeframe, ...input.input.stateTimeframes]))
const barsByTimeframe: Record<string, Bar[]> = {}
for (const timeframe of requestedTimeframes) {
  const history = input.historyBarsBySymbolTimeframe.get(this.buildHistoryKey(bar.symbol, timeframe))
  if (history?.rawBars.length) {
    barsByTimeframe[timeframe] = history.rawBars
  }
}

const multiLegContext = buildRuntimeMarketContext({
  symbol: bar.symbol,
  baseTimeframe: input.input.baseTimeframe,
  primaryCloseTs: bar.closeTime,
  params: input.input.strategy.params,
  barsByTimeframe,
})
```

Keep the existing `buildMultiLegStrategyContext(multiLegContext)` call and `primaryBars` behavior, but derive `primaryBars` from `multiLegContext.data.primary[input.input.baseTimeframe]?.bars ?? []`.

- [ ] **Step 4: Run backtest acceptance**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts -t "uses 15m as primary clock"
```

Expected: PASS.

- [ ] **Step 5: Commit backtest integration**

```bash
git add apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): align backtest secondary data by primary close

Refs: #runtime-data-portal
MSG
```

## Task 9: Backtest Market Data Uses Derived Plan

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-market-data.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-market-data.service.spec.ts`

- [ ] **Step 1: Add test that frontend `stateTimeframes` cannot drop requirements**

Add a test to `backtest-market-data.service.spec.ts` that calls the coverage/load path with `baseTimeframe: '15m'`, `stateTimeframes: []`, and a strategy data requirement containing `['1h', '4h']`. Assert the service requests `15m`, `1h`, and `4h`.

```ts
it('loads snapshot-derived secondary timeframes even when payload stateTimeframes is empty', async () => {
  const input = createInput({
    baseTimeframe: '15m',
    stateTimeframes: [],
    strategy: {
      dataRequirements: {
        primary: ['15m', '1h', '4h'],
      },
    },
  })

  await service.loadBars(input)

  expect(marketDataRepository.findBars).toHaveBeenCalledWith(expect.objectContaining({
    timeframes: ['15m', '1h', '4h'],
  }))
})
```

- [ ] **Step 2: Implement timeframe extraction**

In `backtest-market-data.service.ts`, add a private helper:

```ts
private resolveRequestedTimeframes(input: Pick<BacktestRunInput, 'baseTimeframe' | 'stateTimeframes' | 'strategy'>): Timeframe[] {
  const fromStrategy = (() => {
    const requirements = input.strategy.dataRequirements
    if (!requirements || typeof requirements !== 'object') return []
    const primary = (requirements as { primary?: unknown }).primary
    return Array.isArray(primary) ? primary.filter((value): value is Timeframe => typeof value === 'string') : []
  })()
  return Array.from(new Set<Timeframe>([input.baseTimeframe, ...input.stateTimeframes, ...fromStrategy]))
}
```

Replace local constructions like:

```ts
const timeframes = [...new Set<Timeframe>([input.baseTimeframe, ...input.stateTimeframes])]
```

with:

```ts
const timeframes = this.resolveRequestedTimeframes(input)
```

- [ ] **Step 3: Run market data tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/services/backtest-market-data.service.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit market data plan usage**

```bash
git add apps/quantify/src/modules/backtesting/services/backtest-market-data.service.ts apps/quantify/src/modules/backtesting/services/backtest-market-data.service.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): load backtest data from snapshot-derived requirements

Refs: #runtime-data-portal
MSG
```

## Task 10: Live Runtime Context Acceptance

**Files:**
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generator-orchestration-portfolio-risk.spec.ts`

- [ ] **Step 1: Add live-context test**

Add this assertion in `signal-generator-orchestration-portfolio-risk.spec.ts` near existing `buildPublishedStrategyContext` tests:

```ts
it('builds live context with closed secondary series for 15m/1h/4h EMA acceptance strategy', () => {
  const context = decisionStage.buildPublishedStrategyContext({
    bars: [{ open: 100, high: 110, low: 95, close: 108, volume: 1, timestamp: 15_300_000 }],
    symbol: 'BTCUSDT',
    timeframe: '15m',
    indicators: {},
    currentPrice: 108,
    timestamp: 15_300_000,
    params: { marketType: 'perp' },
    runtimeBarsByTimeframe: {
      '15m': [{ symbol: 'BTCUSDT', timeframe: '15m', openTime: 14_400_000, closeTime: 15_300_000, open: 100, high: 110, low: 95, close: 108, volume: 1 }],
      '1h': [{ symbol: 'BTCUSDT', timeframe: '1h', openTime: 10_800_000, closeTime: 14_400_000, open: 100, high: 110, low: 95, close: 106, volume: 1 }],
      '4h': [{ symbol: 'BTCUSDT', timeframe: '4h', openTime: 0, closeTime: 14_400_000, open: 90, high: 110, low: 80, close: 105, volume: 1 }],
    },
  })

  const data = (context as { data?: Record<string, Record<string, { bars: Array<{ timestamp: number }> }>> }).data?.primary
  expect(data?.['15m']?.bars.at(-1)?.timestamp).toBe(15_300_000)
  expect(data?.['1h']?.bars.at(-1)?.timestamp).toBe(14_400_000)
  expect(data?.['4h']?.bars.at(-1)?.timestamp).toBe(14_400_000)
})
```

- [ ] **Step 2: Extend decision stage input type**

In `signal-generation-decision.stage.ts`, extend `PublishedStrategyRuntimeContextInput` with:

```ts
runtimeBarsByTimeframe?: Record<string, Bar[]>
```

Import the local `Bar` type from `@/modules/backtesting/types/backtesting.types` if no shared bar type exists in this file.

- [ ] **Step 3: Use assembler in live context**

Inside `buildPublishedStrategyContext`, if `runtimeBarsByTimeframe` exists, call `buildRuntimeMarketContext` and merge its fields into the returned context:

```ts
const runtimeMarketContext = input.runtimeBarsByTimeframe
  ? buildRuntimeMarketContext({
      symbol: input.symbol,
      baseTimeframe: input.timeframe,
      primaryCloseTs: input.timestamp,
      params: input.params ?? {},
      barsByTimeframe: input.runtimeBarsByTimeframe,
    })
  : null
```

Add `...(runtimeMarketContext ?? {})` after `buildStrategyContext(...)` in the returned object so compiled runtime sees `data`, `execution`, `legs`, and `dataRequirements`.

- [ ] **Step 4: Wire signal generator**

In `signal-generator.service.ts`, when secondary bars are available from the snapshot-derived plan, pass them as `runtimeBarsByTimeframe`. If only primary bars exist in the current code path, pass:

```ts
runtimeBarsByTimeframe: {
  [timeframe]: bars.map(bar => ({
    symbol: symbolCode,
    timeframe,
    openTime: bar.timestamp,
    closeTime: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  })),
}
```

Then add follow-up loading for secondary series in the same service using the runtime data plan resolver from Task 4.

- [ ] **Step 5: Run live context test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-generator-orchestration-portfolio-risk.spec.ts -t "builds live context with closed secondary series"
```

Expected: PASS.

- [ ] **Step 6: Commit live context integration**

```bash
git add apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts apps/quantify/src/modules/strategy-signals/services/signal-generator-orchestration-portfolio-risk.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): assemble live runtime data context from snapshot plan

Refs: #runtime-data-portal
MSG
```

## Task 11: Diagnostics for Missing Required Data

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/types/backtesting.types.ts`
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts`

- [ ] **Step 1: Extend diagnostic reason union**

Add `BACKTEST_DATA_REQUIREMENT_UNAVAILABLE` to `BacktestDiagnosticReasonCode`:

```ts
export type BacktestDiagnosticReasonCode =
  | 'BACKTEST_NO_RULES_COMPILED'
  | 'BACKTEST_DATA_REQUIREMENT_UNAVAILABLE'
  | 'BACKTEST_NO_SIGNAL_FIRED_IN_RANGE'
  | 'BACKTEST_SIGNAL_FIRED_BUT_NO_FILL'
```

- [ ] **Step 2: Add missing-data test**

In `backtest-runner.service.spec.ts`, add a test where `stateTimeframes` contains `4h` but no `4h` bars exist. Assert:

```ts
expect(result.summary.diagnosticReason).toBe('BACKTEST_DATA_REQUIREMENT_UNAVAILABLE')
expect(result.diagnostics.signalTriggerCount).toBe(0)
```

- [ ] **Step 3: Implement diagnostic**

In `backtest-runner.service.ts`, before running the strategy for a primary bar, detect required timeframes missing from the assembled runtime context. If any required secondary timeframe has no closed bars at the primary timestamp, record a data requirement diagnostic and return `NOOP` for that bar.

Use this condition:

```ts
const missingRequiredTimeframes = requestedTimeframes.filter((timeframe) => {
  const series = multiLegContext.data.primary[timeframe]
  return !series || series.bars.length === 0
})
```

If `missingRequiredTimeframes.length > 0`, set the run-level diagnostic reason to `BACKTEST_DATA_REQUIREMENT_UNAVAILABLE`.

- [ ] **Step 4: Run diagnostic tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts -t "BACKTEST_DATA_REQUIREMENT_UNAVAILABLE"
```

Expected: PASS.

- [ ] **Step 5: Commit diagnostics**

```bash
git add apps/quantify/src/modules/backtesting/types/backtesting.types.ts apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): diagnose missing runtime data requirements

Refs: #runtime-data-portal
MSG
```

## Task 12: Final Verification

**Files:**
- Verify all modified files from previous tasks.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/dispatcher-self-baseline.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-runtime/runtime-data-plan.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-runtime/runtime-data-portal.spec.ts
dx test unit quantify apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts
dx test unit quantify apps/quantify/src/modules/backtesting/services/backtest-market-data.service.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-generator-orchestration-portfolio-risk.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Build quantify**

Run:

```bash
dx build quantify --dev
```

Expected: exit 0.

- [ ] **Step 3: Inspect status**

Run:

```bash
git status --short
```

Expected: no unstaged implementation changes. Existing user-owned unrelated changes must remain untouched unless they were intentionally absorbed in prior commits.

## Self-Review

Spec coverage:

- P0 `scope.dataSource` compiler correction: Tasks 1-2.
- P1 data plan and point-in-time data portal: Tasks 3-7.
- P1 backtest integration and 15m/1h/4h EMA acceptance: Tasks 8-9.
- P1 live context consistency: Task 10.
- Missing data diagnostics: Task 11.
- Final verification: Task 12.

No unresolved planning markers:

- No open planning markers or deferred-action steps remain.
- Each code-changing task includes concrete code snippets and commands.

Type consistency:

- `RuntimeDataPlan`, `RuntimePrimaryClock`, and `RuntimeMarketSeriesRequirement` are defined before use.
- `buildRuntimeMarketContext` and `getClosedBarsAsOf` signatures are defined before integration tasks.
- Backtest and live both use `primaryCloseTs` and closed-bar `asOf` semantics.
