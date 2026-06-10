# Strategy Plaza Official Backtest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public Strategy Plaza official sample backtest experience that keeps the existing 8 categories and 32 strategies, replaces frontend-generated performance-looking data with evidence-backed data, and adds public official report pages.

**Architecture:** Quantify remains the source of official Strategy Plaza templates and evidence mapping. Backend continues to proxy public Strategy Plaza endpoints while authenticated run/edit and private `btjob-*` reports stay unchanged. Frontend cards and the new official report page consume `officialBacktest` from Strategy Plaza APIs instead of private backtesting job APIs.

**Tech Stack:** NestJS 11, TypeScript, Prisma-generated types, Next.js 16, React 19, Jest, Nx/DX commands, OpenAPI contract generation.

---

## File Structure

**Quantify evidence and API**

- Modify `apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts`: persist downsampled official equity curves in generated evidence.
- Modify `apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts`: cover equity curve downsampling and evidence output shape.
- Modify `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts`: add official backtest evidence and response-facing types.
- Modify `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts`: map evidence into `officialBacktest`, `displayMetrics.tradeCount`, and real `equityCurve`.
- Modify `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts`: expose `officialBacktest` through public templates.
- Modify `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts`: assert all 32 templates and all 8 categories remain, and every live template has official backtest data.
- Modify `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts`: assert list/detail expose official backtest payloads without auth.

**Backend proxy and contracts**

- Modify `apps/backend/src/modules/ai-quant-proxy/dto/strategy-plaza.response.dto.ts`: mirror `officialBacktest` DTOs.
- Modify `apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts`: assert backend proxy returns official backtest data and keeps run/edit authenticated.
- Regenerate `packages/api-contracts/src/generated/backend.ts`, `packages/api-contracts/src/generated/quantify.ts`, and Dart contracts through `dx build contracts` after API changes.

**Frontend cards and official report**

- Modify `apps/front/src/lib/api-strategy-plaza-domain.ts`: add `officialBacktest` client types.
- Modify `apps/front/src/lib/api-strategy-plaza-domain.test.ts`: assert official backtest payloads are unwrapped.
- Modify `apps/front/src/components/ai-quant/StrategyPlaza.tsx`: remove fake users, fake Sharpe, and synthetic `buildSeed()` sparkline; add card navigation, real trade count, confidence label, real curve, and info disclosure.
- Modify `apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx`: cover real metrics, real curve, trade count, confidence, disclosure, and no fake values.
- Modify `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx`: pass a locale-aware `onOpenStrategyReport` callback and preserve run/edit behavior.
- Modify `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx`: assert card props keep run/edit actions separate from navigation.
- Create `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/page.tsx`: public official report route.
- Create `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.tsx`: render official report data with the existing equity chart component and local report summary sections.
- Create `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.ts`: map Strategy Plaza evidence to report presentation data.
- Create tests under `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/` for route rendering and report data mapping.

## Task 1: Extend Official Evidence Types and Generator

**Files:**
- Modify: `apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts`
- Modify: `apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts`
- Modify: `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts`

- [ ] **Step 1: Add failing tests for equity curve downsampling**

Add tests to `apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts`:

```ts
import {
  downsampleEquityCurveForEvidence,
  renderEvidenceConstantSource,
} from '../optimize-official-templates'

describe('official strategy plaza evidence output', () => {
  it('downsamples equity curves while preserving first and last points', () => {
    const points = Array.from({ length: 130 }, (_, index) => ({
      ts: 1_700_000_000_000 + index * 60_000,
      equity: 10_000 + index,
    }))

    const result = downsampleEquityCurveForEvidence(points, 64)

    expect(result).toHaveLength(64)
    expect(result[0]).toEqual(points[0])
    expect(result.at(-1)).toEqual(points.at(-1))
    expect(result.every(point => Number.isFinite(point.ts) && Number.isFinite(point.equity))).toBe(true)
  })

  it('renders official evidence constants with equity curve payloads', () => {
    const source = renderEvidenceConstantSource({
      status: 'VERIFIED',
      generatedAt: '2026-06-06T13:06:23.170Z',
      generatedBy: 'apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts',
      admission: {
        maxDrawdownPctCeiling: 20,
        minWinRate: 0.52,
        minTradeCount: 20,
        minTotalReturnPct: 0.5,
      },
      templates: [{
        templateId: 'ma-cross',
        parameterSearchId: 'search-1',
        exchange: 'okx',
        symbol: 'BTC-USDT-SWAP',
        interval: '15m',
        marketType: 'swap',
        source: 'https://www.okx.com/api/v5/market/history-candles',
        dataSource: {
          exchange: 'okx',
          marketType: 'swap',
          endpoint: 'https://www.okx.com/api/v5/market/history-candles',
          fixedEndTs: 1777168800000,
          pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 },
        },
        backtestFrom: 1775008800000,
        backtestTo: 1777167900000,
        admission: {
          maxDrawdownPctCeiling: 20,
          minWinRate: 0.52,
          minTradeCount: 20,
          minTotalReturnPct: 0.5,
        },
        candidateCount: 1,
        candleCount: 2400,
        fromTs: 1775008800000,
        toTs: 1777167900000,
        params: { positionPct: 35 },
        metrics: { winRate: 0.58, maxDrawdownPct: 0.78, totalReturnPct: 1.78, tradeCount: 43 },
        equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10178 }],
        best: {
          params: { positionPct: 35 },
          metrics: { winRate: 0.58, maxDrawdownPct: 0.78, totalReturnPct: 1.78, tradeCount: 43 },
        },
      }],
    })

    expect(source).toContain('equityCurve')
    expect(source).toContain('10178')
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts
```

Expected: FAIL because `downsampleEquityCurveForEvidence` is not exported and evidence template types do not include `equityCurve`.

- [ ] **Step 3: Add types for evidence equity curves and official backtest payloads**

Modify `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts`:

```ts
export interface OfficialStrategyPlazaEvidenceEquityPoint {
  ts: number
  equity: number
}

export type StrategyPlazaOfficialBacktestConfidenceLevel = 'high' | 'medium' | 'low'

export interface StrategyPlazaOfficialBacktestConfidence {
  level: StrategyPlazaOfficialBacktestConfidenceLevel
  reasons: string[]
}

export interface StrategyPlazaOfficialBacktest {
  generatedAt: string
  backtestFrom: number
  backtestTo: number
  source: string
  dataSource: OfficialStrategyPlazaEvidenceDataSource
  eventDataSources?: OfficialStrategyPlazaEvidenceEventDataSource[]
  candleCount: number
  metrics: {
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
    tradeCount: number | null
  }
  equityCurve: OfficialStrategyPlazaEvidenceEquityPoint[]
  confidence: StrategyPlazaOfficialBacktestConfidence
  disclaimer: string
}
```

Extend `OfficialStrategyPlazaEvidenceTemplate`:

```ts
  equityCurve: OfficialStrategyPlazaEvidenceEquityPoint[]
```

Extend `OfficialStrategyPlazaTemplate`:

```ts
  officialBacktest: StrategyPlazaOfficialBacktest
```

- [ ] **Step 4: Implement equity curve downsampling and evidence output**

Modify `apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts`:

```ts
export function downsampleEquityCurveForEvidence(
  points: OptimizerEquityPoint[],
  maxPoints = 64,
): OptimizerEquityPoint[] {
  const validPoints = points
    .filter(point => Number.isFinite(point.ts) && Number.isFinite(point.equity))
    .sort((left, right) => left.ts - right.ts)

  if (validPoints.length <= maxPoints) return validPoints
  if (maxPoints < 2) return validPoints.slice(0, 1)

  const result: OptimizerEquityPoint[] = []
  const lastIndex = validPoints.length - 1
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * lastIndex)
    const point = validPoints[sourceIndex]
    if (!result.some(existing => existing.ts === point.ts)) result.push(point)
  }

  if (result[0]?.ts !== validPoints[0]?.ts) result.unshift(validPoints[0])
  if (result.at(-1)?.ts !== validPoints.at(-1)?.ts) result.push(validPoints.at(-1)!)
  return result.slice(0, maxPoints)
}
```

When building each evidence entry, compute the selected simulation once and persist its curve:

```ts
const selectedRun = spec.run(bars, best.params)

return {
  templateId: spec.templateId,
  parameterSearchId,
  exchange: spec.exchange,
  symbol: spec.symbol,
  interval: spec.interval,
  marketType: spec.marketType,
  source,
  dataSource,
  eventDataSources,
  backtestFrom,
  backtestTo,
  admission: ADMISSION,
  candidateCount: candidates.length,
  candleCount: bars.length,
  fromTs: backtestFrom,
  toTs: backtestTo,
  params: best.params,
  metrics: selectedRun.metrics,
  equityCurve: downsampleEquityCurveForEvidence(selectedRun.equityCurve, 64),
  best: {
    params: best.params,
    metrics: selectedRun.metrics,
  },
}
```

Keep the surrounding entry fields exactly as they are in the current script.

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts \
  apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts \
  apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts
git commit -F - <<'MSG'
feat: add official plaza evidence equity curves

Refs: #2391
MSG
```

## Task 2: Map Official Backtest Payloads in Quantify

**Files:**
- Modify: `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts`
- Modify: `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts`
- Modify: `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts`
- Modify: `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts`

- [ ] **Step 1: Add failing service tests for 32 templates and official backtest data**

Add to `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts`:

```ts
it('keeps 32 live official templates across 8 categories with official backtest payloads', () => {
  const templates = service.list()
  const categories = new Set(templates.map(template => template.category))

  expect(templates).toHaveLength(32)
  expect(categories).toEqual(new Set(['趋势', '突破', '反转', '网格', 'DCA', '盘口', '衍生品事件', '风控稳健']))
  expect(templates.every(template => template.officialBacktest)).toBe(true)
  expect(templates.every(template => template.officialBacktest.disclaimer.includes('历史回测不代表未来收益'))).toBe(true)
})

it('maps ma-cross official evidence into public official backtest payload', () => {
  const template = service.getRequired('ma-cross')

  expect(template.displayMetrics).toMatchObject({
    returnPct: 1.78,
    winRatePct: 58.14,
    maxDrawdownPct: 0.78,
    tradeCount: 43,
  })
  expect(template.officialBacktest).toMatchObject({
    generatedAt: OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE.generatedAt,
    backtestFrom: 1775008800000,
    backtestTo: 1777167900000,
    source: 'https://www.okx.com/api/v5/market/history-candles',
    candleCount: 2400,
    metrics: {
      returnPct: 1.78,
      winRatePct: 58.14,
      maxDrawdownPct: 0.78,
      tradeCount: 43,
    },
    confidence: {
      level: expect.stringMatching(/^(high|medium|low)$/),
      reasons: expect.any(Array),
    },
  })
  expect(template.officialBacktest.equityCurve.length).toBeGreaterThan(1)
  expect(template.equityCurve).toEqual(template.officialBacktest.equityCurve.map(point => point.equity))
})
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
```

Expected: FAIL because templates do not expose `officialBacktest` and `tradeCount` yet.

- [ ] **Step 3: Implement evidence mapping and confidence rules**

Modify `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts` with helpers:

```ts
const OFFICIAL_BACKTEST_DISCLAIMER = '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。'

function confidenceFor(seed: TemplateSeed): OfficialStrategyPlazaTemplate['officialBacktest']['confidence'] {
  const evidence = evidenceFor(seed.id)
  if (!evidence) return { level: 'low', reasons: ['缺少官方样本回测证据。'] }

  const metrics = evidence.metrics
  const reasons: string[] = []
  const isOneMinute = seed.timeframe === '1m'
  const isLowFrequency = seed.category === 'DCA' || seed.category === '风控稳健'
  const minTradeCount = isOneMinute ? 100 : isLowFrequency ? 8 : 30

  if (metrics.tradeCount < minTradeCount) {
    reasons.push(`样本偏少：本次官方样本回测产生 ${metrics.tradeCount} 笔交易，统计置信度较低。`)
  }
  if (metrics.totalReturnPct <= 0) {
    reasons.push(`收益偏弱：本次样本窗口收益为 ${metrics.totalReturnPct}%，该模板保留用于展示策略结构。`)
  }
  if (metrics.maxDrawdownPct > DEFAULT_RULES_ADMISSION.maxDrawdownPctCeiling) {
    reasons.push(`回撤偏高：最大回撤 ${metrics.maxDrawdownPct}% 超过官方阈值。`)
  }
  if (metrics.winRate < DEFAULT_RULES_ADMISSION.minWinRate) {
    reasons.push(`胜率偏低：本次样本窗口胜率 ${(metrics.winRate * 100).toFixed(2)}%。`)
  }

  if (reasons.length === 0) return { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] }
  if (reasons.length === 1 && metrics.totalReturnPct > 0 && metrics.maxDrawdownPct <= DEFAULT_RULES_ADMISSION.maxDrawdownPctCeiling) {
    return { level: 'medium', reasons }
  }
  return { level: 'low', reasons }
}

function officialBacktestFor(seed: TemplateSeed): OfficialStrategyPlazaTemplate['officialBacktest'] {
  const evidence = evidenceFor(seed.id)
  const metrics = evidenceParamsMatchSeed(seed) ? evidence?.metrics : undefined
  return {
    generatedAt: OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE.generatedAt,
    backtestFrom: evidence?.backtestFrom ?? 0,
    backtestTo: evidence?.backtestTo ?? 0,
    source: evidence?.source ?? '',
    dataSource: evidence?.dataSource ?? {
      exchange: 'okx',
      marketType: seed.marketType === 'spot' ? 'spot' : 'swap',
      endpoint: '',
      fixedEndTs: 0,
      pagination: { parameter: 'after', pageLimit: 0, pageCount: 0 },
    },
    ...(evidence?.eventDataSources ? { eventDataSources: evidence.eventDataSources } : {}),
    candleCount: evidence?.candleCount ?? 0,
    metrics: {
      returnPct: metrics?.totalReturnPct ?? null,
      winRatePct: metrics ? Number((metrics.winRate * 100).toFixed(2)) : null,
      maxDrawdownPct: metrics?.maxDrawdownPct ?? null,
      tradeCount: metrics?.tradeCount ?? null,
    },
    equityCurve: evidence?.equityCurve ?? [],
    confidence: confidenceFor(seed),
    disclaimer: OFFICIAL_BACKTEST_DISCLAIMER,
  }
}
```

Update `metricsFor` to include `tradeCount`, and update `toTemplate` to set `officialBacktest` and `equityCurve`:

```ts
const officialBacktest = officialBacktestFor(seed)
return {
  ...,
  displayMetrics: {
    ...metricsFor(seed),
    tradeCount: officialBacktest.metrics.tradeCount,
  },
  officialBacktest,
  equityCurve: officialBacktest.equityCurve.map(point => point.equity),
}
```

- [ ] **Step 4: Expose official backtest through Quantify DTO**

Modify `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts`:

```ts
export class StrategyPlazaOfficialBacktestMetricsResponseDto {
  @ApiPropertyOptional({ nullable: true })
  returnPct!: number | null
  @ApiPropertyOptional({ nullable: true })
  winRatePct!: number | null
  @ApiPropertyOptional({ nullable: true })
  maxDrawdownPct!: number | null
  @ApiPropertyOptional({ nullable: true })
  tradeCount!: number | null
}

export class StrategyPlazaOfficialBacktestConfidenceResponseDto {
  @ApiProperty({ enum: ['high', 'medium', 'low'] })
  level!: 'high' | 'medium' | 'low'
  @ApiProperty({ type: [String] })
  reasons!: string[]
}

export class StrategyPlazaOfficialBacktestEquityPointResponseDto {
  @ApiProperty()
  ts!: number
  @ApiProperty()
  equity!: number
}

export class StrategyPlazaOfficialBacktestResponseDto {
  @ApiProperty()
  generatedAt!: string
  @ApiProperty()
  backtestFrom!: number
  @ApiProperty()
  backtestTo!: number
  @ApiProperty()
  source!: string
  @ApiProperty({ type: 'object', additionalProperties: true })
  dataSource!: Record<string, unknown>
  @ApiProperty()
  candleCount!: number
  @ApiProperty({ type: StrategyPlazaOfficialBacktestMetricsResponseDto })
  metrics!: StrategyPlazaOfficialBacktestMetricsResponseDto
  @ApiProperty({ type: [StrategyPlazaOfficialBacktestEquityPointResponseDto] })
  equityCurve!: StrategyPlazaOfficialBacktestEquityPointResponseDto[]
  @ApiProperty({ type: StrategyPlazaOfficialBacktestConfidenceResponseDto })
  confidence!: StrategyPlazaOfficialBacktestConfidenceResponseDto
  @ApiProperty()
  disclaimer!: string
}
```

Add to `StrategyPlazaTemplateResponseDto`:

```ts
  @ApiProperty({ type: StrategyPlazaOfficialBacktestResponseDto })
  officialBacktest!: StrategyPlazaOfficialBacktestResponseDto
```

Set in constructor:

```ts
this.officialBacktest = {
  ...template.officialBacktest,
  dataSource: { ...template.officialBacktest.dataSource },
  metrics: { ...template.officialBacktest.metrics },
  equityCurve: template.officialBacktest.equityCurve.map(point => ({ ...point })),
  confidence: {
    level: template.officialBacktest.confidence.level,
    reasons: [...template.officialBacktest.confidence.reasons],
  },
}
```

- [ ] **Step 5: Add controller test for public official backtest payload**

In `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts`, add or update a list/detail assertion:

```ts
it('exposes official backtest data on public template detail', async () => {
  const result = await controller.detail('ma-cross')

  expect(result.officialBacktest).toMatchObject({
    metrics: expect.objectContaining({ tradeCount: expect.any(Number) }),
    confidence: expect.objectContaining({ level: expect.stringMatching(/^(high|medium|low)$/) }),
    disclaimer: expect.stringContaining('历史回测不代表未来收益'),
  })
  expect(result.officialBacktest.equityCurve.length).toBeGreaterThan(1)
})
```

- [ ] **Step 6: Run Quantify tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts \
  apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts \
  apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts \
  apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts
git commit -F - <<'MSG'
feat: expose official plaza backtest payloads

Refs: #2391
MSG
```

## Task 3: Pass Official Backtest Through Backend Proxy

**Files:**
- Modify: `apps/backend/src/modules/ai-quant-proxy/dto/strategy-plaza.response.dto.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts`

- [ ] **Step 1: Add failing backend proxy DTO/controller tests**

Add to `apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts`:

```ts
it('returns official backtest data from public template detail proxy', async () => {
  service.getStrategyPlazaTemplateDetail.mockResolvedValue({
    id: 'ma-cross',
    name: 'MA Cross',
    description: 'Trend strategy',
    logicDescription: 'MA cross',
    tags: ['trend'],
    riskLevel: 'medium',
    scenario: 'trend',
    exchange: 'okx',
    environment: 'demo',
    marketType: 'perp',
    symbol: 'BTC-USDT-SWAP',
    timeframe: '15m',
    positionPct: 35,
    leverage: 2,
    status: 'live',
    displayOrder: 10,
    displayMetrics: { label: 'official_sample_backtest', returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
    officialBacktest: {
      generatedAt: '2026-06-06T13:06:23.170Z',
      backtestFrom: 1775008800000,
      backtestTo: 1777167900000,
      source: 'https://www.okx.com/api/v5/market/history-candles',
      dataSource: { exchange: 'okx', marketType: 'swap', endpoint: 'https://www.okx.com/api/v5/market/history-candles', fixedEndTs: 1777168800000, pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 } },
      candleCount: 2400,
      metrics: { returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
      equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10178 }],
      confidence: { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] },
      disclaimer: '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。',
    },
  })

  await expect(controller.detail('ma-cross')).resolves.toMatchObject({
    officialBacktest: {
      metrics: { tradeCount: 43 },
      confidence: { level: 'high' },
    },
  })
})
```

- [ ] **Step 2: Run backend controller test and verify it fails**

Run:

```bash
dx test unit backend apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts
```

Expected: FAIL on TypeScript or assertion because backend DTO types do not define `officialBacktest`.

- [ ] **Step 3: Mirror official backtest DTOs in backend**

Modify `apps/backend/src/modules/ai-quant-proxy/dto/strategy-plaza.response.dto.ts` with the same response DTO classes from Task 2. Add this field to `StrategyPlazaTemplateResponseDto`:

```ts
  @ApiProperty({ description: '官方样本回测详情', type: StrategyPlazaOfficialBacktestResponseDto })
  officialBacktest!: StrategyPlazaOfficialBacktestResponseDto
```

Keep the existing `tradeCount` field in `StrategyPlazaDisplayMetricsResponseDto` and ensure fixtures include it.

- [ ] **Step 4: Run backend controller test**

Run:

```bash
dx test unit backend apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/backend/src/modules/ai-quant-proxy/dto/strategy-plaza.response.dto.ts \
  apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts
git commit -F - <<'MSG'
feat: proxy official plaza backtest data

Refs: #2391
MSG
```

## Task 4: Update Frontend API Types and Card Rendering

**Files:**
- Modify: `apps/front/src/lib/api-strategy-plaza-domain.ts`
- Modify: `apps/front/src/lib/api-strategy-plaza-domain.test.ts`
- Modify: `apps/front/src/components/ai-quant/StrategyPlaza.tsx`
- Modify: `apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx`

- [ ] **Step 1: Add failing API type/unwrapping test**

In `apps/front/src/lib/api-strategy-plaza-domain.test.ts`, update `templatePayload` to include:

```ts
officialBacktest: {
  generatedAt: '2026-06-06T13:06:23.170Z',
  backtestFrom: 1775008800000,
  backtestTo: 1777167900000,
  source: 'https://www.okx.com/api/v5/market/history-candles',
  dataSource: {
    exchange: 'okx',
    marketType: 'swap',
    endpoint: 'https://www.okx.com/api/v5/market/history-candles',
    fixedEndTs: 1777168800000,
    pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 },
  },
  candleCount: 2400,
  metrics: { returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
  equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10178 }],
  confidence: { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] },
  disclaimer: '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。',
},
```

Add assertion:

```ts
expect(result[0].officialBacktest.metrics.tradeCount).toBe(43)
expect(result[0].officialBacktest.equityCurve).toHaveLength(2)
```

- [ ] **Step 2: Run API test and verify it fails**

Run:

```bash
dx test unit front apps/front/src/lib/api-strategy-plaza-domain.test.ts
```

Expected: FAIL because `StrategyPlazaTemplate` does not define `officialBacktest`.

- [ ] **Step 3: Add frontend official backtest types**

Modify `apps/front/src/lib/api-strategy-plaza-domain.ts`:

```ts
export interface StrategyPlazaOfficialBacktest {
  generatedAt: string
  backtestFrom: number
  backtestTo: number
  source: string
  dataSource: {
    exchange: 'okx' | 'binance'
    marketType: 'spot' | 'swap'
    endpoint: string
    fixedEndTs: number
    pagination: {
      parameter: string
      pageLimit: number
      pageCount: number
    }
  }
  candleCount: number
  metrics: {
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
    tradeCount: number | null
  }
  equityCurve: Array<{ ts: number; equity: number }>
  confidence: {
    level: 'high' | 'medium' | 'low'
    reasons: string[]
  }
  disclaimer: string
}
```

Add to `StrategyPlazaTemplate`:

```ts
  officialBacktest: StrategyPlazaOfficialBacktest
```

- [ ] **Step 4: Add failing card rendering tests**

In `apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx`, update `template` to include official backtest data and add assertions:

```ts
expect(container.textContent).toContain('官方样本回测')
expect(container.textContent).toContain('43')
expect(container.textContent).toContain('高可信')
expect(container.textContent).not.toContain('跟单')
expect(container.textContent).not.toContain('Sharpe')
```

Add a test that the info disclosure renders metadata after clicking its button:

```ts
const infoButton = container.querySelector('[data-testid="strategy-plaza-backtest-info-button"]') as HTMLButtonElement
await act(async () => {
  infoButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
expect(container.textContent).toContain('2400')
expect(container.textContent).toContain('history-candles')
expect(container.textContent).toContain('历史回测不代表未来收益')
```

- [ ] **Step 5: Run card tests and verify they fail**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
```

Expected: FAIL because cards still show fake users, Sharpe, and synthetic curve state.

- [ ] **Step 6: Implement card model changes**

Modify `apps/front/src/components/ai-quant/StrategyPlaza.tsx`:

- Remove `users` and `sharpe` from `StrategyCardModel`.
- Add:

```ts
  tradeCount: number | null
  confidenceLevel: 'high' | 'medium' | 'low'
  confidenceReasons: string[]
  officialBacktestLabel: string
  equitySeed: number[]
```

Update `toCardModel`:

```ts
const officialMetrics = template.officialBacktest?.metrics ?? template.displayMetrics
const returnPct = officialMetrics.returnPct
const winRatePct = officialMetrics.winRatePct
const maxDrawdownPct = officialMetrics.maxDrawdownPct
const tradeCount = 'tradeCount' in officialMetrics ? officialMetrics.tradeCount ?? null : template.displayMetrics.tradeCount ?? null
const equitySeed = Array.isArray(template.officialBacktest?.equityCurve)
  ? template.officialBacktest.equityCurve.map(point => point.equity)
  : []
```

Remove `buildSeed()` usage. Render `Sparkline` only when `equitySeed.length > 1`; otherwise render a fixed unavailable state:

```tsx
{item.equitySeed.length > 1 ? (
  <Sparkline data={item.equitySeed} index={`card-${index}`} />
) : (
  <div className="flex h-10 w-[116px] items-center justify-center text-xs text-[color:var(--cf-muted)]">--</div>
)}
```

Replace stats labels with real metrics:

```tsx
<div className="l ...">回撤</div>
<div className="v ...">{formatMetricPct(item.maxDrawdownPct)}</div>
<div className="l ...">胜率</div>
<div className="v ...">{formatMetricPct(item.winRatePct)}</div>
<div className="l ...">交易数</div>
<div className="v ...">{item.tradeCount == null ? '--' : item.tradeCount}</div>
```

Add confidence label mapping:

```ts
const CONFIDENCE_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: '高可信',
  medium: '中可信',
  low: '样本偏少',
}
```

Render info disclosure button with `data-testid="strategy-plaza-backtest-info-button"` and a panel with `data-testid="strategy-plaza-backtest-info-panel"` containing range, source, generated time, candle count, and disclaimer.

- [ ] **Step 7: Implement real metric sorting**

Change `SORT_OPTIONS` to remove `sharpe` and add `trades`:

```ts
const SORT_OPTIONS = [
  { key: 'default', label: '默认' },
  { key: 'return', label: '收益' },
  { key: 'drawdown', label: '低回撤' },
  { key: 'winRate', label: '胜率' },
  { key: 'trades', label: '交易数' },
] as const
```

Sort implementation:

```ts
if (sort === 'return') return (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity)
if (sort === 'drawdown') return Math.abs(a.maxDrawdownPct ?? Infinity) - Math.abs(b.maxDrawdownPct ?? Infinity)
if (sort === 'winRate') return (b.winRatePct ?? -Infinity) - (a.winRatePct ?? -Infinity)
if (sort === 'trades') return (b.tradeCount ?? -Infinity) - (a.tradeCount ?? -Infinity)
return a.order - b.order
```

- [ ] **Step 8: Run frontend tests**

Run:

```bash
dx test unit front apps/front/src/lib/api-strategy-plaza-domain.test.ts
dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```bash
git add apps/front/src/lib/api-strategy-plaza-domain.ts \
  apps/front/src/lib/api-strategy-plaza-domain.test.ts \
  apps/front/src/components/ai-quant/StrategyPlaza.tsx \
  apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
git commit -F - <<'MSG'
feat: render plaza cards from official backtest evidence

Refs: #2391
MSG
```

## Task 5: Add Public Official Strategy Report Page

**Files:**
- Create: `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/page.tsx`
- Create: `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.tsx`
- Create: `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.ts`
- Create: `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.test.ts`
- Create: `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/page.test.tsx`
- Modify: `apps/front/src/lib/api-strategy-plaza-domain.ts`
- Modify: `apps/front/src/components/ai-quant/StrategyPlaza.tsx`

- [ ] **Step 1: Add frontend API detail fetch**

Add test to `apps/front/src/lib/api-strategy-plaza-domain.test.ts`:

```ts
it('fetches and unwraps one strategy plaza template detail', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: templatePayload, message: 'ok' }),
  } as Response)
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const { fetchStrategyPlazaTemplateDetail } = await import('./api')
  await expect(fetchStrategyPlazaTemplateDetail('ma-cross')).resolves.toMatchObject({
    id: 'ma-cross',
    officialBacktest: { metrics: { tradeCount: 43 } },
  })

  expect(fetchMock).toHaveBeenCalledWith(
    'http://localhost:3000/api/v1/strategy-plaza/templates/ma-cross',
    expect.objectContaining({ method: 'GET' }),
  )
})
```

Implement in `apps/front/src/lib/api-strategy-plaza-domain.ts`:

```ts
export async function fetchStrategyPlazaTemplateDetail(templateId: string): Promise<StrategyPlazaTemplate> {
  return apiCall(async () => {
    const slug = getStrategyPlazaTemplateSlug(templateId)
    const response = await fetch(buildStrategyPlazaUrl(slug), {
      method: 'GET',
      headers: optionalAuthHeaders(),
    })
    const json = await parseStrategyPlazaJson(response, '获取策略广场模板详情失败')
    return unwrapResponse<StrategyPlazaTemplate>(
      json as StrategyPlazaTemplate | { data?: StrategyPlazaTemplate; message?: string },
    )
  }, 'FETCH_STRATEGY_PLAZA_TEMPLATE_DETAIL')
}
```

- [ ] **Step 2: Add report data mapper tests**

Create `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals'
import { createOfficialBacktestReportData } from './official-backtest-report-data'

describe('createOfficialBacktestReportData', () => {
  it('maps official backtest data into report metrics and context', () => {
    const result = createOfficialBacktestReportData({
      id: 'ma-cross',
      name: 'MA Cross',
      description: 'Trend strategy',
      logicDescription: 'MA cross',
      tags: ['trend'],
      riskLevel: 'medium',
      scenario: 'trend',
      exchange: 'okx',
      environment: 'demo',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: 35,
      leverage: 2,
      status: 'live',
      displayOrder: 10,
      displayMetrics: { label: 'official_sample_backtest', returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
      officialBacktest: {
        generatedAt: '2026-06-06T13:06:23.170Z',
        backtestFrom: 1775008800000,
        backtestTo: 1777167900000,
        source: 'https://www.okx.com/api/v5/market/history-candles',
        dataSource: { exchange: 'okx', marketType: 'swap', endpoint: 'https://www.okx.com/api/v5/market/history-candles', fixedEndTs: 1777168800000, pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 } },
        candleCount: 2400,
        metrics: { returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
        equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10178 }],
        confidence: { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] },
        disclaimer: '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。',
      },
    }, 'zh')

    expect(result.metrics).toEqual({ maxDrawdownPct: 0.78, totalReturnPct: 1.78, winRatePct: 58.14, tradeCount: 43 })
    expect(result.context).toMatchObject({ symbol: 'BTC-USDT-SWAP', timeframe: '15m', marketType: 'perp' })
    expect(result.report.equitySeries).toHaveLength(2)
    expect(result.confidence.level).toBe('high')
  })
})
```

- [ ] **Step 3: Implement report data mapper**

Create `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.ts`:

```ts
import type { StrategyPlazaTemplate } from '@/lib/api'
import type { BacktestReportContext, BacktestReportMetrics } from '../../backtest/[id]/backtest-report-data'

export function createOfficialBacktestReportData(template: StrategyPlazaTemplate, lng: 'zh' | 'en') {
  const official = template.officialBacktest
  const metrics: BacktestReportMetrics = {
    maxDrawdownPct: official.metrics.maxDrawdownPct ?? 0,
    totalReturnPct: official.metrics.returnPct ?? 0,
    winRatePct: official.metrics.winRatePct ?? 0,
    tradeCount: official.metrics.tradeCount ?? 0,
  }
  const context: BacktestReportContext = {
    exchange: template.exchange,
    marketType: template.marketType,
    symbol: template.symbol,
    timeframe: template.timeframe,
    requestedRange: formatUtcRange(official.backtestFrom, official.backtestTo),
    appliedRange: formatUtcRange(official.backtestFrom, official.backtestTo),
    dataCoverage: { isPartial: false, barCount: official.candleCount, expectedBarCount: official.candleCount },
    execution: { leverage: template.leverage ?? undefined, priceSource: template.marketType === 'spot' ? 'last' : 'mark' },
  }
  return {
    metrics,
    context,
    confidence: official.confidence,
    disclaimer: official.disclaimer,
    generatedAt: official.generatedAt,
    source: official.source,
    candleCount: official.candleCount,
    report: {
      equitySeries: mapOfficialEquitySeries(official.equityCurve),
      trades: [],
      openPositions: [],
      maxDrawdownAnalysis: [
        { label: lng === 'zh' ? '最大回撤' : 'Max Drawdown', value: `${metrics.maxDrawdownPct.toFixed(2)}%` },
        { label: lng === 'zh' ? '回测区间' : 'Backtest Range', value: formatUtcRange(official.backtestFrom, official.backtestTo) },
        { label: lng === 'zh' ? 'K线数量' : 'Candles', value: String(official.candleCount) },
      ],
      volatilitySharpe: [],
      insights: official.confidence.reasons,
      confidence: {
        level: official.confidence.level,
        title: lng === 'zh' ? '报告可信度' : 'Report Confidence',
        summary: official.confidence.reasons.join(' '),
        items: official.confidence.reasons.map(reason => ({ label: lng === 'zh' ? '原因' : 'Reason', value: reason })),
      },
      strategyFit: {
        title: lng === 'zh' ? '策略口径' : 'Strategy Scope',
        summary: template.description,
        items: [
          { label: lng === 'zh' ? '策略分类' : 'Category', value: template.category ?? template.scenario },
          { label: lng === 'zh' ? '交易对' : 'Symbol', value: template.symbol },
          { label: lng === 'zh' ? '周期' : 'Timeframe', value: template.timeframe },
        ],
      },
      marketCapabilityNotes: [official.disclaimer],
    },
  }
}

function formatUtcRange(fromTs: number, toTs: number): string {
  return `${new Date(fromTs).toISOString().slice(0, 16).replace('T', ' ')} UTC ~ ${new Date(toTs).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function mapOfficialEquitySeries(points: Array<{ ts: number; equity: number }>) {
  let peak = Number.NEGATIVE_INFINITY
  return points.map((point) => {
    peak = Math.max(peak, point.equity)
    const drawdown = peak > 0 ? -((peak - point.equity) / peak) * 100 : 0
    return {
      time: new Date(point.ts).toISOString().slice(5, 10),
      equity: Number(point.equity.toFixed(2)),
      drawdown: Number(drawdown.toFixed(2)),
    }
  })
}
```

- [ ] **Step 4: Implement official report client**

Create `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.tsx`:

```tsx
'use client'

import type { StrategyPlazaTemplate } from '@/lib/api'
import Link from 'next/link'
import { BacktestEquityChart } from '../../backtest/[id]/BacktestEquityChart'
import { createOfficialBacktestReportData } from './official-backtest-report-data'

export function OfficialStrategyBacktestReportClient({
  lng,
  template,
}: {
  lng: 'zh' | 'en'
  template: StrategyPlazaTemplate
}) {
  const data = createOfficialBacktestReportData(template, lng)
  const isZh = lng === 'zh'
  return (
    <section className="space-y-5">
      <Link href={`/${lng}/ai-quant/plaza`} className="inline-flex w-fit rounded-full border border-[color:var(--cf-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)]">
        {isZh ? '返回策略广场' : 'Back to Plaza'}
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="!text-2xl !font-semibold !leading-8 text-[color:var(--cf-text-strong)]">{template.name}</h1>
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-600">{isZh ? '官方样本回测' : 'Official Sample Backtest'}</span>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">{data.confidence.level}</span>
        </div>
        <p className="text-sm leading-[22px] text-[color:var(--cf-muted)]">{template.description}</p>
      </header>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label={isZh ? '收益' : 'Return'} value={`${data.metrics.totalReturnPct.toFixed(2)}%`} />
        <Metric label={isZh ? '最大回撤' : 'Max Drawdown'} value={`${data.metrics.maxDrawdownPct.toFixed(2)}%`} />
        <Metric label={isZh ? '胜率' : 'Win Rate'} value={`${data.metrics.winRatePct.toFixed(2)}%`} />
        <Metric label={isZh ? '交易数' : 'Trades'} value={String(data.metrics.tradeCount)} />
      </div>
      <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
        <BacktestEquityChart data={data.report.equitySeries} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={isZh ? '回测口径' : 'Backtest Context'}>
          <Row label={isZh ? '回测区间' : 'Range'} value={data.context.appliedRange ?? '--'} />
          <Row label={isZh ? '数据源' : 'Source'} value={data.source} />
          <Row label={isZh ? '生成时间' : 'Generated At'} value={data.generatedAt} />
          <Row label={isZh ? 'K线数量' : 'Candles'} value={String(data.candleCount)} />
        </Panel>
        <Panel title={isZh ? '可信度说明' : 'Confidence'}>
          {data.confidence.reasons.map(reason => <p key={reason} className="text-sm leading-[22px] text-[color:var(--cf-text)]">{reason}</p>)}
          <p className="mt-3 text-xs leading-5 text-[color:var(--cf-muted)]">{data.disclaimer}</p>
        </Panel>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-3"><div className="text-xs text-[color:var(--cf-muted)]">{label}</div><div className="mt-1 font-mono text-lg font-bold text-[color:var(--cf-text-strong)]">{value}</div></div>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4"><h2 className="mb-3 !text-base !font-semibold text-[color:var(--cf-text-strong)]">{title}</h2><div className="space-y-2">{children}</div></div>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-3 text-sm"><span className="w-20 shrink-0 text-[color:var(--cf-muted)]">{label}</span><span className="break-all text-[color:var(--cf-text)]">{value}</span></div>
}
```

- [ ] **Step 5: Implement official report route**

Create `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/page.tsx`:

```tsx
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { fetchStrategyPlazaTemplateDetail } from '@/lib/api'
import { OfficialStrategyBacktestReportClient } from './OfficialStrategyBacktestReportClient'

export default async function StrategyPlazaOfficialBacktestPage({
  params,
}: {
  params: Promise<{ lng: string; templateId: string }> | { lng: string; templateId: string }
}) {
  const resolved = await Promise.resolve(params)
  const lng = resolved.lng === 'en' ? 'en' : 'zh'
  const template = await fetchStrategyPlazaTemplateDetail(resolved.templateId)

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 py-8 md:px-8">
        <OfficialStrategyBacktestReportClient lng={lng} template={template} />
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 6: Update card body navigation**

In `StrategyPlaza.tsx`, wrap card body click or use `useParams`/`useRouter` passed from parent. Minimal approach: add `onOpenStrategyReport?: (templateId: string) => void` to `StrategyPlazaProps`, call it from card article `onClick`, and pass from `PlazaPageClient`:

```ts
const openStrategyReport = (templateId: string) => {
  router.push(`/${lng}/ai-quant/plaza/${templateId}`)
}
```

```tsx
<StrategyPlaza ... onOpenStrategyReport={openStrategyReport} />
```

On action buttons and info button, keep `event.stopPropagation()`.

- [ ] **Step 7: Run route and frontend tests**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.test.ts
dx test unit front apps/front/src/lib/api-strategy-plaza-domain.test.ts
dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add apps/front/src/app/[lng]/ai-quant/plaza/[templateId] \
  apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx \
  apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx \
  apps/front/src/components/ai-quant/StrategyPlaza.tsx \
  apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx \
  apps/front/src/lib/api-strategy-plaza-domain.ts \
  apps/front/src/lib/api-strategy-plaza-domain.test.ts
git commit -F - <<'MSG'
feat: add official plaza backtest report pages

Refs: #2391
MSG
```

## Task 6: Regenerate Contracts and Validate Builds

**Files:**
- Modify generated files under `packages/api-contracts/src/generated/`
- Modify generated files under `packages/api-contracts-dart/lib/` and `packages/api-contracts-dart/openapi/openapi.json`

- [ ] **Step 1: Regenerate contracts**

Run:

```bash
dx build contracts
```

Expected: exit 0 and generated backend/quantify contract files include `officialBacktest` schemas.

- [ ] **Step 2: Run focused unit tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts
dx test unit front apps/front/src/lib/api-strategy-plaza-domain.test.ts
dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.test.ts
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx
```

Expected: all PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 4: Build affected targets**

Run:

```bash
dx build quantify --dev
dx build backend --dev
dx build front --dev
```

Expected: all exit 0.

- [ ] **Step 5: Commit contracts and validation fixes**

```bash
git add packages/api-contracts/src/generated packages/api-contracts-dart apps/backend apps/quantify apps/front
git commit -F - <<'MSG'
chore: regenerate contracts for official plaza backtests

Refs: #2391
MSG
```

## Task 7: Final Review and PR Preparation

**Files:**
- Inspect all changed files.
- No planned source file changes in this task. Any concrete validation defect gets fixed in the task that introduced it before final review resumes.

- [ ] **Step 1: Confirm no private backtest ownership path changed**

Run:

```bash
git diff origin/main...HEAD -- apps/quantify/src/modules/backtesting apps/backend/src/modules/ai-quant-proxy/backtesting.controller.ts apps/front/src/app/[lng]/ai-quant/backtest
```

Expected: no ownership or auth changes for `/backtesting/jobs/:id` and no public use of private `btjob-*` in Strategy Plaza.

- [ ] **Step 2: Confirm Strategy Plaza count and categories are preserved**

Run:

```bash
node - <<'NODE'
const fs = require('fs')
const source = fs.readFileSync('apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts', 'utf8')
const ids = [...source.matchAll(/id: '([^']+)'/g)].map(match => match[1])
const categories = [...source.matchAll(/category: '([^']+)'/g)].map(match => match[1])
console.log({ templateCount: ids.length, categoryCount: new Set(categories).size, categories: [...new Set(categories)].sort() })
NODE
```

Expected output includes `templateCount: 32`, `categoryCount: 8`, and categories `DCA`, `反转`, `衍生品事件`, `突破`, `盘口`, `网格`, `趋势`, `风控稳健`.

- [ ] **Step 3: Review final diff**

Run:

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- apps/front/src/components/ai-quant/StrategyPlaza.tsx | sed -n '1,240p'
```

Expected: diff removes fake card metrics, adds official evidence fields, and keeps run/edit handlers.

- [ ] **Step 4: Prepare PR body**

Use this body with `gh pr create --body-file -`:

```markdown
## 变更目的

- 对应 Issue 验收标准 [1]：保留策略广场现有 8 类 32 个策略，并新增官方样本回测口径。
- 对应 Issue 验收标准 [2]：官方报告页使用 Strategy Plaza evidence，不复用用户私有 `btjob-*`。
- 对应 Issue 验收标准 [3]：卡片移除假用户数、假 Sharpe 和合成曲线。
- 对应 Issue 验收标准 [4]：低样本或弱表现策略通过置信度和原因说明展示风险。
- 对应 Issue 验收标准 [5]：补齐数据模型、前端行为、后端/API 行为、错误处理和测试覆盖。

## 主要改动和解决的问题

- 解决了策略广场卡片混用真实 evidence 与前端派生展示数据的问题。
- 改动点：Quantify official evidence、Strategy Plaza DTO、Backend proxy DTO、Front Strategy Plaza card、官方报告页、API contracts。
- 改动原因：让策略广场成为可信的官方样本回测广场，并保留现有 8 类 32 个策略编排。

## 遗留的问题

- 无。

## 已做的验证

- dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
- dx test unit quantify apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts
- dx test unit backend apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts
- dx test unit front apps/front/src/lib/api-strategy-plaza-domain.test.ts
- dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
- dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.test.ts
- dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.test.tsx
- dx lint
- dx build quantify --dev
- dx build backend --dev
- dx build front --dev
- dx build contracts

##  PR 遗留未做的

- 无。

## 关联

- Closes: #2391
```

- [ ] **Step 5: Commit any PR-only doc fixes**

When the final review changes docs only, commit it:

```bash
git add docs/superpowers/specs/2026-06-10-strategy-plaza-official-backtest-design.md \
  docs/superpowers/plans/2026-06-10-strategy-plaza-official-backtest.md
git commit -F - <<'MSG'
docs: refine official plaza backtest rollout notes

Refs: #2391
MSG
```
