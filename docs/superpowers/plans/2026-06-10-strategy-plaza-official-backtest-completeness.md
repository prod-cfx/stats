# Strategy Plaza Official Backtest Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 32 Strategy Plaza official sample cards show complete real backtest metrics, remove inline card evidence text, and render full official reports with trade details.

**Architecture:** Persist closed trades in the existing official evidence artifact, expose them through Quantify and backend proxy DTOs, and map official evidence into the existing AI backtest report presentation pipeline. Keep card data sourced from official evidence only; fail tests/generation if any live official template has null metrics or zero trades.

**Tech Stack:** TypeScript, NestJS, Next.js/React, Jest, Nx via `dx`, generated OpenAPI contracts.

---

## File Structure

- Modify `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts`: add official trade type and `officialBacktest.trades`.
- Modify `apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts`: persist selected candidate trades, validate complete evidence, and compute confidence from real sample size.
- Modify `apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts`: test trades persistence, invalid evidence rejection, and low-sample confidence.
- Modify `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts`: add official trade response DTO.
- Modify `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts`: assert 32 live templates have non-null metrics and trades.
- Modify `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts`: assert list/detail include official trades.
- Modify `apps/backend/src/modules/ai-quant-proxy/dto/strategy-plaza.response.dto.ts`: add proxy official trade DTO.
- Modify `apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts`: assert proxy includes trades.
- Modify generated contracts under `packages/api-contracts/src/generated/*` and `packages/api-contracts-dart/*` by running `dx build contracts`.
- Modify `apps/front/src/lib/api-strategy-plaza-domain.ts`: add `officialBacktest.trades` to frontend type.
- Modify `apps/front/src/components/ai-quant/StrategyPlaza.tsx`: remove inline official evidence block from cards.
- Modify `apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx`: assert no evidence block and all pagination pages show complete metrics.
- Modify `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.ts`: map official trades into live report data.
- Modify `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.tsx`: render full report sections using shared report data.
- Modify official report tests under `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/*test*`: cover trade details and report sections.

---

### Task 1: Quantify Evidence Types And Validation Tests

**Files:**
- Modify: `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts`
- Modify: `apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts`
- Modify: `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts`

- [ ] **Step 1: Write failing type-level and evidence completeness tests**

Add tests to `apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts`:

```ts
it('serves 32 live official templates with complete sample backtest metrics and trades', () => {
  const templates = service.list()

  expect(templates).toHaveLength(32)
  expect(new Set(templates.map(template => template.category)).size).toBe(8)

  for (const template of templates) {
    expect(template.officialBacktest.metrics.returnPct).not.toBeNull()
    expect(template.officialBacktest.metrics.winRatePct).not.toBeNull()
    expect(template.officialBacktest.metrics.maxDrawdownPct).not.toBeNull()
    expect(template.officialBacktest.metrics.tradeCount).not.toBeNull()
    expect(template.officialBacktest.metrics.tradeCount).toBeGreaterThan(0)
    expect(template.officialBacktest.equityCurve.length).toBeGreaterThan(0)
    expect(template.officialBacktest.trades.length).toBe(template.officialBacktest.metrics.tradeCount)
  }
})

it('does not mark low-sample official backtests as high confidence', () => {
  const lowSampleTemplates = service
    .list()
    .filter(template => (template.officialBacktest.metrics.tradeCount ?? 0) < 20)

  for (const template of lowSampleTemplates) {
    expect(template.officialBacktest.confidence.level).not.toBe('high')
    expect(template.officialBacktest.confidence.reasons.join(' ')).toMatch(/样本|交易|sample|trade/i)
  }
})
```

Add generator tests to `apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts`:

```ts
it('persists selected candidate trades in official evidence', () => {
  const evidence = buildEvidenceForTest({
    templateId: 'ma-cross',
    trades: [
      {
        id: 'ma-cross-1',
        side: 'LONG',
        entryTs: 1775008800000,
        entryPrice: 100,
        exitTs: 1775009700000,
        exitPrice: 101,
        returnPct: 1,
        reasonOpen: 'fast_ma_cross_up',
        reasonClose: 'fast_ma_cross_down',
      },
    ],
  })

  expect(evidence.templates[0]?.trades).toEqual([
    expect.objectContaining({ id: 'ma-cross-1', side: 'LONG', returnPct: 1 }),
  ])
  expect(evidence.templates[0]?.metrics.tradeCount).toBe(1)
})

it('rejects official evidence with empty trades or null metrics', () => {
  expect(() => validateOfficialEvidenceForWrite({
    status: 'VERIFIED',
    generatedAt: '2026-06-10T00:00:00.000Z',
    generatedBy: 'test',
    admission: { maxDrawdownPctCeiling: 20, minWinRate: 0, minTradeCount: 1, minTotalReturnPct: -100 },
    templates: [
      createEvidenceTemplateForTest({
        templateId: 'ma-cross',
        metrics: { winRate: 0, maxDrawdownPct: 0, totalReturnPct: 0, tradeCount: 0 },
        trades: [],
      }),
    ],
  })).toThrow(/tradeCount|trades/i)
})
```

If helper names differ in the file, add exported helpers with exactly these names in Task 2.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
dx test unit quantify apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts
```

Expected: FAIL because `officialBacktest.trades` and validation helpers do not exist, or current evidence has missing trades.

- [ ] **Step 3: Add official trade types**

Modify `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts`:

```ts
export interface OfficialStrategyPlazaEvidenceTrade {
  id: string
  side: 'LONG' | 'SHORT'
  entryTs: number
  entryPrice: number
  exitTs: number
  exitPrice: number
  returnPct: number
  reasonOpen?: string
  reasonClose?: string
  reasonOpenDisplay?: string
  reasonCloseDisplay?: string
}
```

Add to `OfficialStrategyPlazaEvidenceTemplate`:

```ts
trades: OfficialStrategyPlazaEvidenceTrade[]
```

Add to `StrategyPlazaOfficialBacktest`:

```ts
trades: OfficialStrategyPlazaEvidenceTrade[]
```

- [ ] **Step 4: Commit test/type changes**

Run:

```bash
git add apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts \
  apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts \
  apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
git commit -F - <<'MSG'
test: cover official strategy plaza evidence completeness

Refs: #2393
MSG
```

---

### Task 2: Generator Persistence, Confidence, And Evidence Regeneration

**Files:**
- Modify: `apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts`
- Modify: `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-backtest-evidence.json`
- Modify: `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-backtest-evidence.constant.ts`
- Modify: `apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts`

- [ ] **Step 1: Persist trades from selected candidates**

In `apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts`, ensure optimizer trade shape is compatible with evidence:

```ts
interface OptimizerTrade {
  id: string
  side: 'LONG' | 'SHORT'
  entryTs: number
  entryPrice: number
  exitTs: number
  exitPrice: number
  pnlPct: number
  reasonOpen?: string
  reasonClose?: string
  reasonOpenDisplay?: string
  reasonCloseDisplay?: string
}

function mapTradesForEvidence(templateId: string, trades: OptimizerTrade[]) {
  return trades.map((trade, index) => ({
    id: trade.id || `${templateId}-${index + 1}`,
    side: trade.side,
    entryTs: trade.entryTs,
    entryPrice: Number(trade.entryPrice.toFixed(8)),
    exitTs: trade.exitTs,
    exitPrice: Number(trade.exitPrice.toFixed(8)),
    returnPct: Number(trade.pnlPct.toFixed(4)),
    ...(trade.reasonOpen ? { reasonOpen: trade.reasonOpen } : {}),
    ...(trade.reasonClose ? { reasonClose: trade.reasonClose } : {}),
    ...(trade.reasonOpenDisplay ? { reasonOpenDisplay: trade.reasonOpenDisplay } : {}),
    ...(trade.reasonCloseDisplay ? { reasonCloseDisplay: trade.reasonCloseDisplay } : {}),
  }))
}
```

When building each `OfficialStrategyPlazaEvidenceTemplate`, add:

```ts
trades: mapTradesForEvidence(spec.templateId, selected.trades),
```

- [ ] **Step 2: Add evidence write validation**

Export this helper from the same script for tests:

```ts
export function validateOfficialEvidenceForWrite(evidence: OfficialStrategyPlazaBacktestEvidence): void {
  if (evidence.templates.length !== OFFICIAL_STRATEGY_PLAZA_TEMPLATES.length) {
    throw new Error(`Official strategy plaza evidence must contain ${OFFICIAL_STRATEGY_PLAZA_TEMPLATES.length} templates`)
  }

  const liveTemplateIds = new Set(OFFICIAL_STRATEGY_PLAZA_TEMPLATES.map(template => template.id))
  for (const item of evidence.templates) {
    if (!liveTemplateIds.has(item.templateId as never)) {
      throw new Error(`Unknown official strategy plaza evidence template: ${item.templateId}`)
    }
    if (!Number.isFinite(item.metrics.totalReturnPct) || !Number.isFinite(item.metrics.winRate) || !Number.isFinite(item.metrics.maxDrawdownPct)) {
      throw new Error(`Official strategy plaza evidence has invalid metrics: ${item.templateId}`)
    }
    if (!Number.isInteger(item.metrics.tradeCount) || item.metrics.tradeCount <= 0) {
      throw new Error(`Official strategy plaza evidence tradeCount must be > 0: ${item.templateId}`)
    }
    if (!Array.isArray(item.trades) || item.trades.length !== item.metrics.tradeCount) {
      throw new Error(`Official strategy plaza evidence trades length must match tradeCount: ${item.templateId}`)
    }
    if (!Array.isArray(item.equityCurve) || item.equityCurve.length === 0) {
      throw new Error(`Official strategy plaza evidence equityCurve is required: ${item.templateId}`)
    }
  }
}
```

Call `validateOfficialEvidenceForWrite(evidence)` immediately before writing JSON/TS files.

- [ ] **Step 3: Compute confidence from trade count**

Where official templates are mapped from evidence in `official-strategy-plaza-templates.ts`, replace high-by-default confidence with:

```ts
function buildOfficialConfidence(evidence: OfficialStrategyPlazaEvidenceTemplate): StrategyPlazaOfficialBacktestConfidence {
  if (evidence.metrics.tradeCount >= 20) {
    return { level: 'high', reasons: ['样本回测满足官方基础准入条件，闭合交易数量达到目标样本量。'] }
  }

  return {
    level: 'medium',
    reasons: [`样本回测仅包含 ${evidence.metrics.tradeCount} 笔闭合交易，统计置信度低于目标样本量。`],
  }
}
```

Ensure `officialBacktest.metrics` always maps numbers:

```ts
metrics: {
  returnPct: evidence.metrics.totalReturnPct,
  winRatePct: Number((evidence.metrics.winRate * 100).toFixed(2)),
  maxDrawdownPct: evidence.metrics.maxDrawdownPct,
  tradeCount: evidence.metrics.tradeCount,
},
trades: evidence.trades,
```

- [ ] **Step 4: Regenerate official evidence**

Run the existing generation command used by the repo. If the package script is not obvious, run:

```bash
rg -n "optimize-official-templates" package.json apps/quantify/package.json dx -S
```

Then execute the matching `dx` or package script. Expected output: evidence JSON and constant TS update, and generation does not throw validation errors.

- [ ] **Step 5: Run focused Quantify tests**

Run:

```bash
dx test unit quantify apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit generator and evidence**

Run:

```bash
git add apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts \
  apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-backtest-evidence.json \
  apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-backtest-evidence.constant.ts \
  apps/quantify/src/modules/strategy-plaza/constants/official-strategy-plaza-templates.ts
git commit -F - <<'MSG'
fix: complete official strategy plaza backtest evidence

Refs: #2393
MSG
```

---

### Task 3: Quantify And Backend DTOs With Contracts

**Files:**
- Modify: `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts`
- Modify: `apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/dto/strategy-plaza.response.dto.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts`
- Generated: `packages/api-contracts/src/generated/backend.ts`
- Generated: `packages/api-contracts/src/generated/quantify.ts`
- Generated: `packages/api-contracts-dart/**`

- [ ] **Step 1: Write failing API tests for official trades**

In Quantify controller spec, assert response contains trades:

```ts
expect(result[0]?.officialBacktest.trades[0]).toEqual(expect.objectContaining({
  id: expect.any(String),
  side: expect.stringMatching(/LONG|SHORT/),
  entryTs: expect.any(Number),
  entryPrice: expect.any(Number),
  exitTs: expect.any(Number),
  exitPrice: expect.any(Number),
  returnPct: expect.any(Number),
}))
```

In backend proxy controller spec, assert proxied DTO has the same shape:

```ts
expect(result[0]?.officialBacktest.trades.length).toBeGreaterThan(0)
expect(result[0]?.officialBacktest.trades[0]).toEqual(expect.objectContaining({
  id: expect.any(String),
  side: expect.any(String),
  returnPct: expect.any(Number),
}))
```

- [ ] **Step 2: Add DTO classes**

In Quantify DTO file:

```ts
export class StrategyPlazaOfficialBacktestTradeResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty({ enum: ['LONG', 'SHORT'] })
  side!: 'LONG' | 'SHORT'

  @ApiProperty()
  entryTs!: number

  @ApiProperty()
  entryPrice!: number

  @ApiProperty()
  exitTs!: number

  @ApiProperty()
  exitPrice!: number

  @ApiProperty()
  returnPct!: number

  @ApiPropertyOptional()
  reasonOpen?: string

  @ApiPropertyOptional()
  reasonClose?: string

  @ApiPropertyOptional()
  reasonOpenDisplay?: string

  @ApiPropertyOptional()
  reasonCloseDisplay?: string

  constructor(trade: OfficialStrategyPlazaEvidenceTrade) {
    Object.assign(this, trade)
  }
}
```

In official backtest response DTO, add:

```ts
@ApiProperty({ type: () => [StrategyPlazaOfficialBacktestTradeResponseDto] })
trades!: StrategyPlazaOfficialBacktestTradeResponseDto[]
```

Constructor mapping:

```ts
this.trades = official.trades.map(trade => new StrategyPlazaOfficialBacktestTradeResponseDto(trade))
```

Mirror equivalent DTO in backend proxy response DTO file.

- [ ] **Step 3: Run API tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Regenerate contracts**

Run:

```bash
dx build contracts
```

Expected: PASS and generated TS/Dart contract files include official backtest trade DTO.

- [ ] **Step 5: Commit DTO and contracts**

Run:

```bash
git add apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts \
  apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts \
  apps/backend/src/modules/ai-quant-proxy/dto/strategy-plaza.response.dto.ts \
  apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts \
  packages/api-contracts/src/generated/backend.ts \
  packages/api-contracts/src/generated/quantify.ts \
  packages/api-contracts-dart
git commit -F - <<'MSG'
feat: expose official strategy plaza backtest trades

Refs: #2393
MSG
```

---

### Task 4: Frontend Cards Without Inline Evidence And No Empty Metrics

**Files:**
- Modify: `apps/front/src/lib/api-strategy-plaza-domain.ts`
- Modify: `apps/front/src/components/ai-quant/StrategyPlaza.tsx`
- Modify: `apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx`

- [ ] **Step 1: Extend frontend API type**

Add to `StrategyPlazaTemplate['officialBacktest']` in `apps/front/src/lib/api-strategy-plaza-domain.ts`:

```ts
trades: Array<{
  id: string
  side: 'LONG' | 'SHORT'
  entryTs: number
  entryPrice: number
  exitTs: number
  exitPrice: number
  returnPct: number
  reasonOpen?: string
  reasonClose?: string
  reasonOpenDisplay?: string
  reasonCloseDisplay?: string
}>
```

- [ ] **Step 2: Write failing card tests**

In `StrategyPlaza.api.test.tsx`, update fixture `template.officialBacktest` with one trade. Add tests:

```ts
it('does not render inline official evidence blocks inside cards', async () => {
  await act(async () => {
    root.render(
      <StrategyPlaza
        templates={[template]}
        loading={false}
        onRunStrategy={() => undefined}
        onEditStrategy={() => undefined}
      />,
    )
  })

  expect(container.querySelector('[data-testid="strategy-plaza-official-evidence"]')).toBeNull()
  expect(container.textContent).not.toContain('历史回测不代表未来收益')
  expect(container.textContent).not.toContain('K 线 2400')
})

it('keeps complete metrics visible across four strategy pages', async () => {
  const manyTemplates = Array.from({ length: 32 }, (_, index) => ({
    ...template,
    id: `ma-cross-page-${index}`,
    name: `MA Cross Page ${index}`,
    displayOrder: index + 1,
    officialBacktest: {
      ...template.officialBacktest,
      metrics: { returnPct: 1 + index, winRatePct: 50 + index / 10, maxDrawdownPct: 1, tradeCount: 21 + index },
    },
  }))

  await act(async () => {
    root.render(
      <StrategyPlaza
        templates={manyTemplates}
        loading={false}
        onRunStrategy={() => undefined}
        onEditStrategy={() => undefined}
      />,
    )
  })

  for (const page of ['1', '2', '3', '4']) {
    await act(async () => {
      Array.from(container.querySelectorAll('[data-testid="strategy-plaza-pager"] button'))
        .find(button => button.textContent?.trim() === page)
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const cardTexts = Array.from(container.querySelectorAll('[data-testid="strategy-plaza-card"]'))
      .map(card => card.textContent ?? '')
    expect(cardTexts.length).toBeGreaterThan(0)
    for (const text of cardTexts) {
      expect(text).not.toContain('--')
      expect(text).toMatch(/交易\s*\d+/)
      expect(text).toMatch(/胜率\s*\d/)
    }
  }
})
```

- [ ] **Step 3: Remove inline evidence block from cards**

In `StrategyPlaza.tsx`, delete the `<details data-testid="strategy-plaza-official-evidence">...</details>` block and remove unused `Info` import if no longer used.

Keep event isolation tests for run/edit buttons.

- [ ] **Step 4: Run frontend card tests**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit card changes**

Run:

```bash
git add apps/front/src/lib/api-strategy-plaza-domain.ts \
  apps/front/src/components/ai-quant/StrategyPlaza.tsx \
  apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
git commit -F - <<'MSG'
fix: simplify strategy plaza cards and require complete metrics

Refs: #2393
MSG
```

---

### Task 5: Full Official Report With Trades

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.test.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.test.tsx`

- [ ] **Step 1: Write failing report data test**

In `official-backtest-report-data.test.ts`, add fixture trade and assert full mapped report data:

```ts
it('maps official backtest trades into full live report presentation data', () => {
  const data = createOfficialBacktestReportData(template, 'zh')

  expect(data?.reportData.trades).toHaveLength(1)
  expect(data?.reportData.trades[0]).toEqual(expect.objectContaining({
    id: 'official-trade-1',
    direction: 'long',
    profitPct: 1.2,
  }))
  expect(data?.reportData.insights.length).toBeGreaterThan(0)
  expect(data?.reportData.maxDrawdownAnalysis.length).toBeGreaterThan(0)
  expect(data?.reportData.volatilitySharpe.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Map official evidence into shared report pipeline**

In `official-backtest-report-data.ts`, import existing live report creator:

```ts
import type { BacktestReportContext, BacktestReportData, BacktestReportMetrics, EquityPoint } from '../../backtest/[id]/backtest-report-data'
import { createBacktestReportDataFromLive } from '../../backtest/[id]/backtest-report-data'
```

Extend `OfficialBacktestReportData`:

```ts
reportData: BacktestReportData
reportContext: BacktestReportContext
```

Inside `createOfficialBacktestReportData`, build metrics and report input:

```ts
const metrics: BacktestReportMetrics = {
  totalReturnPct: official.metrics.returnPct ?? 0,
  winRatePct: official.metrics.winRatePct ?? 0,
  maxDrawdownPct: official.metrics.maxDrawdownPct ?? 0,
  tradeCount: official.metrics.tradeCount ?? 0,
  openTradeCount: 0,
  openPnl: 0,
}

const reportData = createBacktestReportDataFromLive(
  `official-${template.id}`,
  metrics,
  {
    equityCurve: official.equityCurve,
    trades: official.trades,
    openPositions: [],
  },
  {
    lng,
    context: {
      exchange: template.exchange,
      marketType: template.marketType,
      symbol: template.symbol,
      timeframe: template.timeframe,
      appliedRange: `${formatDate(official.backtestFrom)} - ${formatDate(official.backtestTo)}`,
      dataCoverage: { isPartial: false, barCount: official.candleCount },
      execution: { leverage: template.leverage, allowPartial: false },
    },
  },
)

if (!reportData) {
  throw new Error('官方样本回测数据不完整，无法生成报告')
}
```

Return `reportData` and `reportContext` with existing fields.

- [ ] **Step 3: Write failing report component test**

In `OfficialStrategyBacktestReportClient.test.tsx`, assert sections:

```ts
expect(container.textContent).toContain('报告解读')
expect(container.textContent).toContain('最大回撤分析')
expect(container.textContent).toContain('波动率与夏普')
expect(container.textContent).toContain('交易明细')
expect(container.textContent).toContain('official-trade-1')
expect(container.textContent).toContain('历史回测不代表未来收益')
```

- [ ] **Step 4: Render full report sections**

In `OfficialStrategyBacktestReportClient.tsx`, reuse existing report sections where exported. If they are not exported from `BacktestReportClient.tsx`, extract pure presentation sections to a new nearby module:

```ts
apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportSections.tsx
```

Move or export these components without changing behavior:

- `DecisionSummarySection`
- `AiAnalysisPanel`
- `RiskCard`
- `TradeDetailsSection`
- `OpenPositionsSection`

Then official report renders:

```tsx
<DecisionSummarySection
  confidence={report.reportData.confidence}
  strategyFit={report.reportData.strategyFit}
  marketCapabilityNotes={report.reportData.marketCapabilityNotes}
/>
<BacktestEquityChart lng={lng} data={report.reportData.equitySeries} />
<AiAnalysisPanel lng={lng} insights={report.reportData.insights} />
<section className="grid gap-4 lg:grid-cols-2">
  <RiskCard title={lng === 'en' ? 'Max Drawdown Analysis' : '最大回撤分析'} data={report.reportData.maxDrawdownAnalysis} />
  <RiskCard title={lng === 'en' ? 'Volatility & Sharpe' : '波动率与夏普'} data={report.reportData.volatilitySharpe} />
</section>
<TradeDetailsSection lng={lng} trades={report.reportData.trades} marketType={report.marketType} />
```

Keep evidence metadata and disclaimer below the decision report sections.

- [ ] **Step 5: Run report tests**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.test.ts
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.test.tsx
dx test unit front apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit report changes**

Run:

```bash
git add apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.ts \
  apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.tsx \
  apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.test.ts \
  apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.test.tsx \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.tsx \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportSections.tsx \
  apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.test.tsx
git commit -F - <<'MSG'
feat: render full official strategy plaza backtest reports

Refs: #2393
MSG
```

---

### Task 6: Final Verification And PR

**Files:**
- Modify if needed: test snapshots or generated contracts only when caused by prior tasks.

- [ ] **Step 1: Run focused tests**

Run:

```bash
dx test unit quantify apps/quantify/scripts/strategy-plaza/__tests__/optimize-official-templates.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-plaza/services/official-strategy-plaza-template.service.spec.ts
dx test unit quantify apps/quantify/src/modules/strategy-plaza/controllers/strategy-plaza.controller.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/strategy-plaza.controller.spec.ts
dx test unit front apps/front/src/components/ai-quant/StrategyPlaza.api.test.tsx
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/official-backtest-report-data.test.ts
dx test unit front apps/front/src/app/[lng]/ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Run required gates**

Run:

```bash
dx lint
dx build affected --dev
dx build contracts
```

Expected: all PASS.

- [ ] **Step 3: Check git state**

Run:

```bash
git status --short --branch --untracked-files=all
```

Expected: only known local untracked `.superpowers/.../server.pid` may remain; no source changes unstaged.

- [ ] **Step 4: Push branch and create PR**

Run:

```bash
git push -u origin fix/2393-strategy-plaza-official-backtest-completeness
gh pr create --title "fix: complete strategy plaza official backtest data" --body-file - <<'MSG'
## 变更目的

- 对应 Issue #2393：策略广场 32 个官方样本卡片不再出现空指标，官方报告补齐交易明细和解释性分析。

## 主要改动和解决的问题

- 官方样本 evidence 增加真实闭合交易并校验 32 个策略完整性。
- Quantify/backend proxy DTO 暴露 `officialBacktest.trades`。
- 策略卡片移除底部官方样本说明块，只保留核心指标。
- 官方样本报告复用 AI 回测报告呈现逻辑，展示交易明细、报告解读、回撤分析、波动率/夏普和风险说明。

## 遗留的问题

- 无。

## 已做的验证

- dx lint → 通过
- dx build affected --dev → 通过
- dx build contracts → 通过
- focused Quantify/backend/front Strategy Plaza tests → 通过

##  PR 遗留未做的

- 无。

## 关联

Closes: #2393
MSG
```

Expected: PR created.

---

## Self-Review

- Spec coverage: Tasks cover 32 strategies, non-null metrics, real trades, optimization validation, removed card evidence block, full report, DTO/contracts, and tests.
- Placeholder scan: no placeholder markers, no deferred validation, no unspecified test command.
- Type consistency: trade field names match existing `LiveBacktestReportInput` where official report maps trades: `side`, `entryTs`, `entryPrice`, `exitTs`, `exitPrice`, `returnPct`.
