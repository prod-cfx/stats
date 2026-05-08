# AI Quant Contract-First Natural Language Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a contract-first natural language gateway so complex AI Quant utterances normalize into `SemanticState` and user-visible display/canonical output without leaking internal keys.

**Architecture:** Keep `SemanticState` as the truth boundary after natural-language parsing. Add a focused gateway that turns raw text into semantic frames, a normalizer that converts those frames into the existing `CodegenSemanticPatch`/`SemanticState` pipeline, and a presentation registry that ties supported atom metadata to aliases, examples, display names, and clarification renderers.

**Tech Stack:** NestJS services in `apps/quantify`, TypeScript strict mode, Jest via `dx test unit quantify`, existing `SemanticSeedExtractorService`, `SemanticSeedStateBuilderService`, `SemanticContractReadinessService`, `SemanticStateProjectionService`, and `CanonicalSpecBuilderService`.

---

## Scope Notes

This plan implements the P0 gateway slice from the spec:

- Context: exchange, symbol, market type, timeframe.
- Indicators: EMA/MA/SMA, BOLL/Bollinger aliases.
- Multi-indicator AND gates: price above/below EMA20/60/144.
- BOLL boundary entry: lower long, upper short.
- Basic stop loss percent.
- Missing sizing clarification only.
- Display/canonical assertions that no internal key leaks to user-visible text.

The plan does not implement portfolio orchestration, cross-symbol risk, or new runtime semantics. Phase 3/4/5 execution work remains separate.

## File Structure

Create:

- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts`
  - Frame interfaces for context, indicator compare, boundary touch, risk, action, and grouping.
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-presentation.ts`
  - Presentation metadata types for aliases, examples, display names, and renderers.
- `apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts`
  - Raw text to typed semantic frames.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts`
  - Frames to `CodegenSemanticPatch`, then buildable into `SemanticState`.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts`
  - Contract atom presentation metadata and guard helpers.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-natural-language-gateway.service.spec.ts`
  - Gateway frame tests.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-frame-normalizer.service.spec.ts`
  - Frame-to-patch tests.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-presentation-registry.service.spec.ts`
  - Metadata completeness and internal-key leak tests.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-gateway-golden-corpus.spec.ts`
  - P0 full-chain test.

Modify:

- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Use gateway frames before legacy extractor fallback merge.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
  - Use presentation registry for atom display text and assert no raw internal fallback leaks.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-question-renderer.service.ts`
  - Add P0 sizing/business slot wording through the existing `render(input)` API.
- `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`
  - Register the new services.

## Task 1: Presentation Metadata Contract

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-presentation.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-presentation-registry.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`

- [ ] **Step 1: Write failing metadata tests**

Create `semantic-presentation-registry.service.spec.ts`:

```ts
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'

describe('SemanticPresentationRegistryService', () => {
  const atomRegistry = new SemanticAtomRegistryService()
  const presentation = new SemanticPresentationRegistryService()

  it('has presentation metadata for every supported atom used by the P0 gateway', () => {
    const requiredKeys = [
      'condition.expression',
      'indicator.boundary_touch',
      'price.detect.indicator_boundary',
      'risk.stop_loss_pct',
      'open_long',
      'open_short',
      'position.fixed_pct',
      'position.fixed_notional',
      'position.fixed_quantity',
    ]

    for (const key of requiredKeys) {
      const atom = atomRegistry.resolve(key)
      expect(atom.supportStatus).toMatch(/^supported_/u)
      expect(presentation.get(key)).toEqual(expect.objectContaining({
        key,
        publicName: expect.any(String),
        aliases: expect.arrayContaining([expect.any(String)]),
        positiveExamples: expect.arrayContaining([expect.any(String)]),
        displayRenderer: expect.any(Function),
        clarificationRenderer: expect.any(Function),
      }))
    }
  })

  it('formats BOLL and EMA semantics without leaking internal keys', () => {
    const bollText = presentation.renderDisplay('price.detect.indicator_boundary', {
      indicator: { name: 'bollinger', period: 20, stdDev: 2 },
      boundaryRole: 'lower',
      confirmationMode: 'touch',
    })
    const emaText = presentation.renderDisplay('condition.expression', {
      label: '价格同时位于 EMA20、EMA60、EMA144 上方',
    })

    expect(bollText).toBe('触及 BOLL 下轨（20, 2）')
    expect(emaText).toBe('价格同时位于 EMA20、EMA60、EMA144 上方')
    expect(`${bollText} ${emaText}`).not.toMatch(/generic_boundary|indicator\.above|indicator\.below|price\.detect\.indicator_boundary/u)
  })
})
```

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-presentation-registry.service.spec.ts
```

Expected: FAIL because the service and type do not exist.

- [ ] **Step 2: Add presentation types**

Create `semantic-presentation.ts`:

```ts
export interface SemanticPresentationRenderInput {
  params: Record<string, unknown>
}

export interface SemanticPresentationMetadata {
  key: string
  publicName: string
  aliases: readonly string[]
  positiveExamples: readonly string[]
  negativeExamples: readonly string[]
  displayRenderer: (input: SemanticPresentationRenderInput) => string
  clarificationRenderer: (slotKey: string, params: Record<string, unknown>) => string
}
```

- [ ] **Step 3: Add presentation registry service**

Create `semantic-presentation-registry.service.ts` with a curated P0 map:

```ts
import { Injectable } from '@nestjs/common'
import type { SemanticPresentationMetadata } from '../types/semantic-presentation'

const INTERNAL_KEY_PATTERN = /\b(?:generic_boundary|indicator\.(?:above|below)|price\.detect\.indicator_boundary)\b/u

const METADATA: SemanticPresentationMetadata[] = [
  {
    key: 'condition.expression',
    publicName: '组合条件',
    aliases: ['价格都在', '同时满足', '都位于'],
    positiveExamples: ['价格都位于 EMA20 EMA60 EMA144 上方'],
    negativeExamples: ['随便看看 EMA'],
    displayRenderer: ({ params }) => String(params.label ?? '组合条件'),
    clarificationRenderer: () => '请确认组合条件的比较方向。',
  },
  {
    key: 'price.detect.indicator_boundary',
    publicName: '指标边界触发',
    aliases: ['BOLL 上轨', 'BOLL 下轨', '布林带上轨', '布林带下轨'],
    positiveExamples: ['BOLL 下轨开多', '触及布林带上轨做空'],
    negativeExamples: ['上边界随便看看'],
    displayRenderer: ({ params }) => formatIndicatorBoundary(params),
    clarificationRenderer: () => '请确认触发的是指标上轨、中轨还是下轨。',
  },
  {
    key: 'indicator.boundary_touch',
    publicName: '指标边界触碰',
    aliases: ['触及上轨', '触及下轨'],
    positiveExamples: ['触及 BOLL 下轨'],
    negativeExamples: ['离下轨很近'],
    displayRenderer: ({ params }) => formatIndicatorBoundary(params),
    clarificationRenderer: () => '请确认触碰的指标边界。',
  },
  {
    key: 'risk.stop_loss_pct',
    publicName: '百分比止损',
    aliases: ['亏损百分', '止损百分', '亏损 % 止损'],
    positiveExamples: ['亏损 5% 止损'],
    negativeExamples: ['手续费 5%'],
    displayRenderer: ({ params }) => `亏损 ${formatNumber(params.valuePct)}% 止损`,
    clarificationRenderer: () => '请确认止损百分比。',
  },
  {
    key: 'open_long',
    publicName: '开多',
    aliases: ['开多', '做多', '买入开仓'],
    positiveExamples: ['下轨开多'],
    negativeExamples: ['看多'],
    displayRenderer: () => '开多',
    clarificationRenderer: () => '请确认开多仓位大小。',
  },
  {
    key: 'open_short',
    publicName: '开空',
    aliases: ['开空', '做空', '卖空'],
    positiveExamples: ['上轨开空'],
    negativeExamples: ['看空'],
    displayRenderer: () => '开空',
    clarificationRenderer: () => '请确认开空仓位大小。',
  },
  {
    key: 'position.fixed_pct',
    publicName: '百分比仓位',
    aliases: ['仓位百分比', '单笔百分比'],
    positiveExamples: ['单笔 10%'],
    negativeExamples: ['止损 10%'],
    displayRenderer: ({ params }) => `单笔 ${formatNumber(params.value)}% 仓位`,
    clarificationRenderer: () => '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。',
  },
  {
    key: 'position.fixed_notional',
    publicName: '固定金额仓位',
    aliases: ['USDT 仓位', '固定金额'],
    positiveExamples: ['单笔 10 USDT'],
    negativeExamples: ['盈利 10 USDT'],
    displayRenderer: ({ params }) => `单笔 ${formatNumber(params.value)} ${String(params.asset ?? 'USDT')}`,
    clarificationRenderer: () => '请确认单笔使用多少计价货币。',
  },
  {
    key: 'position.fixed_quantity',
    publicName: '固定数量仓位',
    aliases: ['固定币数', 'base 数量'],
    positiveExamples: ['每次买 0.001 BTC'],
    negativeExamples: ['BTCUSDT 标的'],
    displayRenderer: ({ params }) => `单笔 ${formatNumber(params.value)} ${String(params.asset ?? '')}`.trim(),
    clarificationRenderer: () => '请确认单笔交易的币种数量。',
  },
]

@Injectable()
export class SemanticPresentationRegistryService {
  private readonly metadata = new Map(METADATA.map(item => [item.key, item]))

  get(key: string): SemanticPresentationMetadata {
    const metadata = this.metadata.get(key)
    if (!metadata) {
      throw new Error(`semantic_presentation_not_registered:${key}`)
    }
    return metadata
  }

  renderDisplay(key: string, params: Record<string, unknown>): string {
    return assertNoInternalKeyLeak(this.get(key).displayRenderer({ params }))
  }
}

function formatIndicatorBoundary(params: Record<string, unknown>): string {
  const rawIndicator = readRecord(params.indicator)
  const indicatorName = String(rawIndicator?.name ?? params.indicator ?? 'BOLL').toLowerCase()
  const indicator = indicatorName === 'bollinger' || indicatorName === 'boll' ? 'BOLL' : indicatorName.toUpperCase()
  const role = String(params.boundaryRole ?? rawIndicator?.boundaryRole ?? '')
  const roleText = role === 'upper' ? '上轨' : role === 'middle' ? '中轨' : role === 'lower' ? '下轨' : '边界'
  const period = readNumber(rawIndicator?.period ?? params.period)
  const stdDev = readNumber(rawIndicator?.stdDev ?? params.stdDev)
  const paramText = period !== null && stdDev !== null ? `（${formatNumber(period)}, ${formatNumber(stdDev)}）` : ''
  return `触及 ${indicator} ${roleText}${paramText}`
}

function assertNoInternalKeyLeak(text: string): string {
  if (INTERNAL_KEY_PATTERN.test(text)) {
    throw new Error(`semantic_presentation_internal_key_leak:${text}`)
  }
  return text
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(8)).toString() : String(value ?? '')
}
```

- [ ] **Step 4: Register the service**

Modify `llm-strategy-codegen.module.ts`:

```ts
import { SemanticPresentationRegistryService } from './services/semantic-presentation-registry.service'
```

Add `SemanticPresentationRegistryService` to `providers`.

- [ ] **Step 5: Run the metadata test**

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-presentation-registry.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-presentation.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-presentation-registry.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-presentation-registry.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts
git commit -F - <<'MSG'
feat: add semantic presentation registry

Refs: #984
MSG
```

## Task 2: Natural Language Gateway Frames

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-natural-language-gateway.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`

- [ ] **Step 1: Write failing frame tests**

Create `semantic-natural-language-gateway.service.spec.ts`:

```ts
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'

describe('NaturalLanguageGatewayService', () => {
  const gateway = new NaturalLanguageGatewayService()

  it('extracts P0 context, EMA gates, BOLL entries, and stop loss frames', () => {
    const frames = gateway.parse('15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损')

    expect(frames).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'context', field: 'timeframe', value: '15m' }),
      expect.objectContaining({ kind: 'context', field: 'exchange', value: 'binance' }),
      expect.objectContaining({ kind: 'context', field: 'symbol', value: 'BTCUSDT' }),
      expect.objectContaining({ kind: 'context', field: 'marketType', value: 'perp' }),
      expect.objectContaining({ kind: 'combination', sideScope: 'long', join: 'AND' }),
      expect.objectContaining({ kind: 'combination', sideScope: 'short', join: 'AND' }),
      expect.objectContaining({ kind: 'boundary_touch', indicator: 'bollinger', boundaryRole: 'lower', sideScope: 'long' }),
      expect.objectContaining({ kind: 'boundary_touch', indicator: 'bollinger', boundaryRole: 'upper', sideScope: 'short' }),
      expect.objectContaining({ kind: 'risk', riskKey: 'risk.stop_loss_pct', valuePct: 5 }),
    ]))

    const emaFrames = frames.filter(frame => frame.kind === 'indicator_compare')
    expect(emaFrames).toHaveLength(6)
    expect(emaFrames).toEqual(expect.arrayContaining([
      expect.objectContaining({ indicator: 'ema', period: 20, operator: 'GT', sideScope: 'long' }),
      expect.objectContaining({ indicator: 'ema', period: 60, operator: 'GT', sideScope: 'long' }),
      expect.objectContaining({ indicator: 'ema', period: 144, operator: 'GT', sideScope: 'long' }),
      expect.objectContaining({ indicator: 'ema', period: 20, operator: 'LT', sideScope: 'short' }),
      expect.objectContaining({ indicator: 'ema', period: 60, operator: 'LT', sideScope: 'short' }),
      expect.objectContaining({ indicator: 'ema', period: 144, operator: 'LT', sideScope: 'short' }),
    ]))
  })

  it('normalizes BOLL aliases instead of generic boundary names', () => {
    const aliases = ['boll下轨开多', 'BOLL 下轨开多', '布林下轨开多', '布林带下轨开多']

    for (const alias of aliases) {
      expect(gateway.parse(alias)).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'boundary_touch', indicator: 'bollinger', boundaryRole: 'lower' }),
      ]))
    }
  })
})
```

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-natural-language-gateway.service.spec.ts
```

Expected: FAIL because the gateway does not exist.

- [ ] **Step 2: Add frame types**

Create `semantic-natural-language-frame.ts`:

```ts
export type SemanticNaturalLanguageFrame =
  | SemanticContextFrame
  | SemanticIndicatorCompareFrame
  | SemanticBoundaryTouchFrame
  | SemanticActionFrame
  | SemanticRiskFrame
  | SemanticCombinationFrame

export interface SemanticFrameBase {
  id: string
  evidenceText: string
  confidence: number
}

export interface SemanticContextFrame extends SemanticFrameBase {
  kind: 'context'
  field: 'exchange' | 'symbol' | 'marketType' | 'timeframe'
  value: string
}

export interface SemanticIndicatorCompareFrame extends SemanticFrameBase {
  kind: 'indicator_compare'
  indicator: 'ema' | 'ma' | 'sma'
  period: number
  operator: 'GT' | 'LT'
  sideScope: 'long' | 'short'
  groupId: string
}

export interface SemanticBoundaryTouchFrame extends SemanticFrameBase {
  kind: 'boundary_touch'
  indicator: 'bollinger'
  boundaryRole: 'upper' | 'middle' | 'lower'
  sideScope: 'long' | 'short'
  phase: 'entry' | 'exit'
}

export interface SemanticActionFrame extends SemanticFrameBase {
  kind: 'action'
  actionKey: 'open_long' | 'open_short' | 'close_long' | 'close_short'
}

export interface SemanticRiskFrame extends SemanticFrameBase {
  kind: 'risk'
  riskKey: 'risk.stop_loss_pct'
  valuePct: number
}

export interface SemanticCombinationFrame extends SemanticFrameBase {
  kind: 'combination'
  groupId: string
  join: 'AND' | 'OR'
  sideScope: 'long' | 'short'
}
```

- [ ] **Step 3: Implement the gateway parser**

Create `natural-language-gateway.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import type { SemanticNaturalLanguageFrame } from '../types/semantic-natural-language-frame'

@Injectable()
export class NaturalLanguageGatewayService {
  parse(input?: string): SemanticNaturalLanguageFrame[] {
    const text = normalize(input)
    if (!text) return []

    return [
      ...this.parseContext(text),
      ...this.parseMultiEmaGates(text),
      ...this.parseBollingerBoundaryEntries(text),
      ...this.parseRisk(text),
    ]
  }

  private parseContext(text: string): SemanticNaturalLanguageFrame[] {
    const frames: SemanticNaturalLanguageFrame[] = []
    const timeframe = /(?:^|[^\w])(\d+)\s*(?:min|m|分钟)\s*(?:k|K|线|周期)?/u.exec(text)?.[1]
    if (timeframe) frames.push(contextFrame('timeframe', `${Number(timeframe)}m`, timeframe))
    if (/币安|binance/iu.test(text)) frames.push(contextFrame('exchange', 'binance', '币安'))
    const symbol = /\b([A-Z]{2,10})\s*[-/]?\s*(USDT|USDC|USD)\b/iu.exec(text)
    if (symbol) frames.push(contextFrame('symbol', `${symbol[1].toUpperCase()}${symbol[2].toUpperCase()}`, symbol[0]))
    if (/永续|合约|perp|swap/iu.test(text)) frames.push(contextFrame('marketType', 'perp', '永续合约'))
    if (/现货|spot/iu.test(text)) frames.push(contextFrame('marketType', 'spot', '现货'))
    return frames
  }

  private parseMultiEmaGates(text: string): SemanticNaturalLanguageFrame[] {
    const frames: SemanticNaturalLanguageFrame[] = []
    const longPeriods = parsePeriodsBeforeDirection(text, /上方/u)
    const shortPeriods = parsePeriodsBeforeDirection(text, /下方/u)

    if (longPeriods.length > 1 && /只开多|做多|开多/u.test(text)) {
      frames.push(combinationFrame('gate-long-ema', 'long', 'AND', '价格都位于 EMA 上方'))
      longPeriods.forEach(period => frames.push(compareFrame('gate-long-ema', 'long', period, 'GT')))
    }
    if (shortPeriods.length > 1 && /只开空|做空|开空/u.test(text)) {
      frames.push(combinationFrame('gate-short-ema', 'short', 'AND', '价格都位于 EMA 下方'))
      shortPeriods.forEach(period => frames.push(compareFrame('gate-short-ema', 'short', period, 'LT')))
    }
    return frames
  }

  private parseBollingerBoundaryEntries(text: string): SemanticNaturalLanguageFrame[] {
    const frames: SemanticNaturalLanguageFrame[] = []
    const hasBoll = /boll|布林|布林带/iu.test(text)
    if (hasBoll && /下轨[^，。；;]*?(开多|做多|买入)/u.test(text)) {
      frames.push(boundaryFrame('lower', 'long', '下轨开多'))
      frames.push(actionFrame('open_long', '下轨开多'))
    }
    if ((hasBoll || /下轨[^，。；;]*(?:开多|做多|买入)/u.test(text)) && /上轨[^，。；;]*?(开空|做空|卖空)/u.test(text)) {
      frames.push(boundaryFrame('upper', 'short', '上轨开空'))
      frames.push(actionFrame('open_short', '上轨开空'))
    }
    return frames
  }

  private parseRisk(text: string): SemanticNaturalLanguageFrame[] {
    const match = /(?:亏损|止损)[^\d]{0,8}(?:百分)?\s*(\d+(?:\.\d+)?)\s*%?/u.exec(text)
    if (!match) return []
    return [{
      id: 'risk-stop-loss-pct',
      kind: 'risk',
      riskKey: 'risk.stop_loss_pct',
      valuePct: Number(match[1]),
      evidenceText: match[0],
      confidence: 0.95,
    }]
  }
}

function normalize(input?: string): string {
  return (input ?? '').replace(/\s+/gu, ' ').trim()
}

function contextFrame(field: 'exchange' | 'symbol' | 'marketType' | 'timeframe', value: string, evidenceText: string): SemanticNaturalLanguageFrame {
  return { id: `context-${field}`, kind: 'context', field, value, evidenceText, confidence: 0.95 }
}

function combinationFrame(groupId: string, sideScope: 'long' | 'short', join: 'AND' | 'OR', evidenceText: string): SemanticNaturalLanguageFrame {
  return { id: `combination-${groupId}`, kind: 'combination', groupId, join, sideScope, evidenceText, confidence: 0.9 }
}

function compareFrame(groupId: string, sideScope: 'long' | 'short', period: number, operator: 'GT' | 'LT'): SemanticNaturalLanguageFrame {
  return { id: `compare-${sideScope}-ema-${period}`, kind: 'indicator_compare', indicator: 'ema', period, operator, sideScope, groupId, evidenceText: `EMA${period}`, confidence: 0.9 }
}

function boundaryFrame(boundaryRole: 'upper' | 'middle' | 'lower', sideScope: 'long' | 'short', evidenceText: string): SemanticNaturalLanguageFrame {
  return { id: `boundary-bollinger-${boundaryRole}-${sideScope}`, kind: 'boundary_touch', indicator: 'bollinger', boundaryRole, sideScope, phase: 'entry', evidenceText, confidence: 0.92 }
}

function actionFrame(actionKey: 'open_long' | 'open_short' | 'close_long' | 'close_short', evidenceText: string): SemanticNaturalLanguageFrame {
  return { id: `action-${actionKey}`, kind: 'action', actionKey, evidenceText, confidence: 0.9 }
}

function parsePeriodsBeforeDirection(text: string, direction: RegExp): number[] {
  const match = new RegExp(`(?:价格|收盘价|k线|K线)?[^。；;，,]{0,30}?((?:ema\\s*\\d+\\s*){2,})[^。；;，,]{0,10}?${direction.source}`, 'iu').exec(text)
  if (!match) return []
  return [...match[1].matchAll(/ema\s*(\d+)/giu)].map(item => Number(item[1])).filter(Number.isFinite)
}
```

- [ ] **Step 4: Register the gateway service**

Modify `llm-strategy-codegen.module.ts`:

```ts
import { NaturalLanguageGatewayService } from './services/natural-language-gateway.service'
```

Add `NaturalLanguageGatewayService` to `providers`.

- [ ] **Step 5: Run the frame tests**

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-natural-language-gateway.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-natural-language-frame.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/natural-language-gateway.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-natural-language-gateway.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts
git commit -F - <<'MSG'
feat: parse contract-first natural language frames

Refs: #984
MSG
```

## Task 3: Frame Normalizer To Existing Semantic Pipeline

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-frame-normalizer.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`

- [ ] **Step 1: Write failing normalizer tests**

Create `semantic-frame-normalizer.service.spec.ts`:

```ts
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'

describe('SemanticFrameNormalizerService', () => {
  const gateway = new NaturalLanguageGatewayService()
  const normalizer = new SemanticFrameNormalizerService()

  it('normalizes P0 frames into buildable semantic patch', () => {
    const frames = gateway.parse('15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损')
    const patch = normalizer.normalize(frames)

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
    }))
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'condition.expression', phase: 'gate', sideScope: 'long' }),
      expect.objectContaining({ key: 'condition.expression', phase: 'gate', sideScope: 'short' }),
      expect.objectContaining({ key: 'price.detect.indicator_boundary', phase: 'entry', sideScope: 'long', params: expect.objectContaining({ boundaryRole: 'lower' }) }),
      expect.objectContaining({ key: 'price.detect.indicator_boundary', phase: 'entry', sideScope: 'short', params: expect.objectContaining({ boundaryRole: 'upper' }) }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'open_short' }),
    ]))
    expect(patch.risk).toEqual([
      expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 5 }) }),
    ])
    expect(JSON.stringify(patch)).not.toMatch(/generic_boundary|indicator\.above|indicator\.below/u)
  })
})
```

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-frame-normalizer.service.spec.ts
```

Expected: FAIL because the normalizer does not exist.

- [ ] **Step 2: Implement normalizer**

Create `semantic-frame-normalizer.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { SemanticExpression } from '../types/semantic-state'
import type { SemanticNaturalLanguageFrame } from '../types/semantic-natural-language-frame'

@Injectable()
export class SemanticFrameNormalizerService {
  normalize(frames: readonly SemanticNaturalLanguageFrame[]): CodegenSemanticPatch {
    const contextSlots: NonNullable<CodegenSemanticPatch['contextSlots']> = {}
    const triggers: NonNullable<CodegenSemanticPatch['triggers']> = []
    const actions: NonNullable<CodegenSemanticPatch['actions']> = []
    const risk: NonNullable<CodegenSemanticPatch['risk']> = []

    for (const frame of frames) {
      if (frame.kind === 'context') contextSlots[frame.field] = frame.value
      if (frame.kind === 'boundary_touch') triggers.push(boundaryTrigger(frame))
      if (frame.kind === 'action') actions.push({ key: frame.actionKey, evidence: evidence(frame.evidenceText) })
      if (frame.kind === 'risk') risk.push(stopLossRisk(frame.valuePct, frame.evidenceText))
    }

    const groups = new Map<string, Extract<SemanticNaturalLanguageFrame, { kind: 'indicator_compare' }>[]>()
    frames.forEach((frame) => {
      if (frame.kind !== 'indicator_compare') return
      groups.set(frame.groupId, [...(groups.get(frame.groupId) ?? []), frame])
    })
    groups.forEach((items, groupId) => {
      const [first] = items
      if (!first) return
      triggers.push({
        key: 'condition.expression',
        phase: 'gate',
        sideScope: first.sideScope,
        params: {
          expression: buildAndExpression(items),
          displayGroupId: groupId,
          label: formatEmaGateLabel(items),
        },
        evidence: evidence(items.map(item => item.evidenceText).join(' ')),
      })
    })

    const patch: CodegenSemanticPatch = {}
    if (Object.keys(contextSlots).length > 0) patch.contextSlots = contextSlots
    if (triggers.length > 0) patch.triggers = triggers
    if (actions.length > 0) patch.actions = uniqueActions(actions)
    if (risk.length > 0) patch.risk = risk
    return patch
  }
}

function boundaryTrigger(frame: Extract<SemanticNaturalLanguageFrame, { kind: 'boundary_touch' }>): NonNullable<CodegenSemanticPatch['triggers']>[number] {
  return {
    key: 'price.detect.indicator_boundary',
    phase: frame.phase,
    sideScope: frame.sideScope,
    params: {
      indicator: { name: 'bollinger', period: 20, stdDev: 2 },
      boundaryRole: frame.boundaryRole,
      confirmationMode: 'touch',
    },
    evidence: evidence(frame.evidenceText),
  }
}

function stopLossRisk(valuePct: number, evidenceText: string): NonNullable<CodegenSemanticPatch['risk']>[number] {
  return {
    key: 'risk.stop_loss_pct',
    params: {
      valuePct,
      direction: 'loss',
      basis: 'entry_avg_price',
      basisSource: 'user_explicit',
      effect: 'close_position',
      scope: 'current_position',
    },
    evidence: evidence(evidenceText),
  }
}

function buildAndExpression(items: Array<Extract<SemanticNaturalLanguageFrame, { kind: 'indicator_compare' }>>): SemanticExpression {
  return {
    kind: 'AND',
    children: items.map(item => ({
      kind: 'predicate',
      op: item.operator,
      left: { kind: 'series', source: 'bar', field: 'close' },
      right: { kind: 'indicator', name: 'ema', params: { period: item.period } },
    })),
  }
}

function formatEmaGateLabel(items: Array<Extract<SemanticNaturalLanguageFrame, { kind: 'indicator_compare' }>>): string {
  const direction = items[0]?.operator === 'LT' ? '下方' : '上方'
  return `价格同时位于 ${items.map(item => `EMA${item.period}`).join('、')} ${direction}`
}

function evidence(text: string) {
  return { text, source: 'user_explicit' as const }
}

function uniqueActions(actions: NonNullable<CodegenSemanticPatch['actions']>): NonNullable<CodegenSemanticPatch['actions']> {
  const seen = new Set<string>()
  return actions.filter((action) => {
    if (seen.has(action.key)) return false
    seen.add(action.key)
    return true
  })
}
```

- [ ] **Step 3: Register the normalizer service**

Modify `llm-strategy-codegen.module.ts`:

```ts
import { SemanticFrameNormalizerService } from './services/semantic-frame-normalizer.service'
```

Add `SemanticFrameNormalizerService` to `providers`.

- [ ] **Step 4: Run the normalizer test**

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-frame-normalizer.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-frame-normalizer.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-frame-normalizer.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts
git commit -F - <<'MSG'
feat: normalize natural language frames to semantic patch

Refs: #984
MSG
```

## Task 4: Wire Gateway Into Seed Extraction

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`

- [ ] **Step 1: Add failing extractor P0 test**

Append to `semantic-seed-extractor.service.spec.ts`:

```ts
it('routes P0 multi-indicator BOLL strategy through contract-first gateway without generic boundary fallback', () => {
  const patch = service.extract('15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损')

  expect(patch.contextSlots).toEqual(expect.objectContaining({
    exchange: 'binance',
    symbol: expect.objectContaining({ value: 'BTCUSDT' }),
    marketType: 'perp',
    timeframe: '15m',
  }))
  expect(patch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'condition.expression', phase: 'gate', sideScope: 'long' }),
    expect.objectContaining({ key: 'condition.expression', phase: 'gate', sideScope: 'short' }),
    expect.objectContaining({ key: 'price.detect.indicator_boundary', sideScope: 'long', params: expect.objectContaining({ boundaryRole: 'lower' }) }),
    expect.objectContaining({ key: 'price.detect.indicator_boundary', sideScope: 'short', params: expect.objectContaining({ boundaryRole: 'upper' }) }),
  ]))
  expect(patch.actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'open_long' }),
    expect.objectContaining({ key: 'open_short' }),
  ]))
  expect(patch.risk).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 5 }) }),
  ]))
  expect(JSON.stringify(patch)).not.toMatch(/generic_boundary|indicator\.above|indicator\.below/u)
})
```

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
```

Expected: FAIL until `SemanticSeedExtractorService` uses the gateway.

- [ ] **Step 2: Inject gateway and normalizer into extractor**

Modify constructor in `semantic-seed-extractor.service.ts`:

```ts
import { NaturalLanguageGatewayService } from './natural-language-gateway.service'
import { SemanticFrameNormalizerService } from './semantic-frame-normalizer.service'
```

Add constructor params after `eventFrameProjector`:

```ts
private readonly naturalLanguageGateway: NaturalLanguageGatewayService = new NaturalLanguageGatewayService(),
private readonly frameNormalizer: SemanticFrameNormalizerService = new SemanticFrameNormalizerService(),
```

- [ ] **Step 3: Merge gateway patch first in `extract`**

At the top of `extract`, after `aliasContext` is computed, add:

```ts
const gatewayPatch = this.frameNormalizer.normalize(this.naturalLanguageGateway.parse(text))
```

When building `triggers`, merge `gatewayPatch.triggers ?? []` before event frames and legacy extracted triggers:

```ts
this.mergeSeedTriggers(
  gatewayPatch.triggers ?? [],
  this.mergeSeedTriggers(eventFramePatch.triggers ?? [], this.extractTriggers(text, aliasContext)),
)
```

When building `actions`, merge `gatewayPatch.actions ?? []` before event-frame and legacy actions:

```ts
this.mergeSeedActions(
  gatewayPatch.actions ?? [],
  this.mergeSeedActions(
    this.mergeSeedActions(eventFramePatch.actions ?? [], this.extractActions(text, triggers)),
    lifecycleActions,
  ),
)
```

When building `risk`, merge gateway risk with legacy risk by stable key/params:

```ts
const risk = this.atomizeRisk(this.mergeSeedRisk(gatewayPatch.risk ?? [], this.extractRisk(text)))
```

Add helper:

```ts
private mergeSeedRisk(
  primaryRisk: readonly SeedRisk[],
  secondaryRisk: readonly SeedRisk[],
): SeedRisk[] {
  const merged: SeedRisk[] = []
  const seen = new Set<string>()
  for (const risk of [...primaryRisk, ...secondaryRisk]) {
    const signature = JSON.stringify({
      key: risk.key,
      params: this.stableValue(risk.params ?? {}),
    })
    if (seen.has(signature)) continue
    seen.add(signature)
    merged.push(risk)
  }
  return merged
}
```

Merge context slots with gateway context taking precedence:

```ts
const contextSlots = {
  ...legacyContextSlots,
  ...(gatewayPatch.contextSlots ?? {}),
}
```

Keep symbol resolution behavior by letting existing `extractContextSlots` and `SemanticSeedStateBuilderService` normalize object/string symbols.

- [ ] **Step 4: Run extractor tests**

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
git commit -F - <<'MSG'
feat: wire contract-first gateway into seed extraction

Refs: #984
MSG
```

## Task 5: Display And Clarification Leak Guards

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-question-renderer.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-question-renderer.service.spec.ts`

- [ ] **Step 1: Add failing display projection test**

Append to `semantic-state-projection.service.spec.ts`:

```ts
it('renders P0 gateway semantics without internal key leakage', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const projection = new SemanticStateProjectionService()
  const state = builder.build(extractor.extract('15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损'))
  if (!state) throw new Error('state_not_built')

  const view = projection.buildConversationView(state)
  const graph = projection.buildDisplayLogicGraph(state)
  const text = `${view.summary} ${JSON.stringify(graph)}`

  expect(text).toContain('EMA20')
  expect(text).toContain('EMA60')
  expect(text).toContain('EMA144')
  expect(text).toContain('BOLL')
  expect(text).toContain('下轨')
  expect(text).toContain('上轨')
  expect(text).not.toMatch(/generic_boundary|indicator\.above|indicator\.below|price\.detect\.indicator_boundary/u)
})
```

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
```

Expected: FAIL if display still falls back to internal keys.

- [ ] **Step 2: Inject presentation registry into projection**

Modify constructor:

```ts
constructor(
  private readonly presentationRegistry: SemanticPresentationRegistryService = new SemanticPresentationRegistryService(),
) {}
```

Import `SemanticPresentationRegistryService`.

- [ ] **Step 3: Use presentation registry in trigger formatting**

In `formatDisplayIndicatorBoundaryCondition`, replace hand-built fallback with:

```ts
return this.presentationRegistry.renderDisplay('price.detect.indicator_boundary', {
  indicator,
  boundaryRole,
  confirmationMode: trigger.params.confirmationMode,
})
```

In `formatDisplayTriggerCondition`, after summary fallback, guard the returned text:

```ts
return this.assertNoInternalDisplayKey(summary
  .replace(/^(入场|出场|条件)：/u, '')
  .replace(/时(?:做多开仓|做空开仓|双向开仓|买入|平多|平空|双向平仓|卖出平仓)$/u, '')
  .trim())
```

Add helper:

```ts
private assertNoInternalDisplayKey(text: string): string {
  if (/\b(?:generic_boundary|indicator\.(?:above|below)|price\.detect\.indicator_boundary)\b/u.test(text)) {
    return ''
  }
  return text
}
```

- [ ] **Step 4: Add clarification test for missing sizing**

Append to `semantic-clarification-question-renderer.service.spec.ts`:

```ts
it('asks only for position sizing after P0 gateway strategy is otherwise understood', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const projection = new SemanticStateProjectionService()
  const state = builder.build(extractor.extract('15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损'))
  if (!state) throw new Error('state_not_built')

  const question = projection.buildClarificationView(state).nextQuestion ?? ''

  expect(question).toMatch(/仓位|单笔|10%|USDT|BTC/u)
  expect(question).not.toMatch(/generic_boundary|上轨还是下轨|交易所|标的|周期/u)
})
```

- [ ] **Step 5: Run projection and clarification tests**

Run:

```bash
dx test unit quantify -- --runTestsByPath \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-question-renderer.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-question-renderer.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-question-renderer.service.spec.ts
git commit -F - <<'MSG'
fix: prevent semantic display internal key leakage

Refs: #984
MSG
```

## Task 6: Full-Chain Gateway Golden Corpus

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-gateway-golden-corpus.spec.ts`

- [ ] **Step 1: Write full-chain golden test**

Create `semantic-gateway-golden-corpus.spec.ts`:

```ts
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

describe('semantic gateway golden corpus', () => {
  const message = '15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损'

  it('keeps P0 strategy coherent from raw input to display and canonical spec', () => {
    const gateway = new NaturalLanguageGatewayService()
    const normalizer = new SemanticFrameNormalizerService()
    const extractor = new SemanticSeedExtractorService()
    const builder = new SemanticSeedStateBuilderService()
    const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())
    const readiness = new SemanticContractReadinessService()
    const projection = new SemanticStateProjectionService()
    const canonicalBuilder = new CanonicalSpecBuilderService()

    const frames = gateway.parse(message)
    const gatewayPatch = normalizer.normalize(frames)
    const patch = extractor.extract(message)
    const state = builder.build(patch)
    if (!state) throw new Error('state_not_built')

    const classified = classifier.classify(state)
    const normalized = readiness.normalize(classified.state)
    const view = projection.buildConversationView(normalized.state)
    const graph = projection.buildDisplayLogicGraph(normalized.state)
    const canonical = canonicalBuilder.build({ semanticState: normalized.state })
    const text = `${JSON.stringify(frames)} ${JSON.stringify(gatewayPatch)} ${view.summary} ${JSON.stringify(graph)} ${JSON.stringify(canonical)}`

    expect(frames.length).toBeGreaterThanOrEqual(10)
    expect(gatewayPatch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'condition.expression', sideScope: 'long' }),
      expect.objectContaining({ key: 'condition.expression', sideScope: 'short' }),
      expect.objectContaining({ key: 'price.detect.indicator_boundary', sideScope: 'long' }),
      expect.objectContaining({ key: 'price.detect.indicator_boundary', sideScope: 'short' }),
    ]))
    expect(normalized.ready).toBe(false)
    expect(text).toContain('EMA20')
    expect(text).toContain('EMA60')
    expect(text).toContain('EMA144')
    expect(text).toContain('BOLL')
    expect(text).not.toMatch(/generic_boundary|indicator\.above|indicator\.below/u)
    expect(normalized.state.position?.openSlots ?? []).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: expect.stringMatching(/position|sizing/u) }),
    ]))
    expect(canonical).toEqual(expect.objectContaining({
      version: expect.any(Number),
    }))
  })
})
```

- [ ] **Step 2: Run golden corpus test**

Run:

```bash
dx test unit quantify -- --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-gateway-golden-corpus.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit Task 6**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-gateway-golden-corpus.spec.ts
git commit -F - <<'MSG'
test: add semantic gateway golden corpus

Refs: #984
MSG
```

## Task 7: Final Verification

**Files:**
- No new files unless verification exposes a focused bug.

- [ ] **Step 1: Run targeted unit tests**

```bash
dx test unit quantify -- --runTestsByPath \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-presentation-registry.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-natural-language-gateway.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-frame-normalizer.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-question-renderer.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-gateway-golden-corpus.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run quantify build**

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 3: Check no internal key appears in new tests or docs as expected output**

```bash
rg -n "generic_boundary|indicator\\.above|indicator\\.below" apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-*gateway* apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-*projection*
```

Expected: only negative assertions such as `not.toMatch(...)`, no expected user-visible text containing those keys.

- [ ] **Step 4: Confirm verification left no local changes**

```bash
git status --short
```

Expected: no output. When this command shows modified files, return to the task that owns those files, fix the failing assertion there, rerun Task 7 from Step 1, and commit through that owning task's commit step.

## Self-Review Checklist

- Spec coverage: covered raw input -> frames, frames -> semantic patch/state, display, clarification, canonical, and P0 golden case.
- Scope control: does not touch runtime/backtest/live signal execution paths.
- Internal key safety: presentation registry and golden corpus both assert no `generic_boundary`, `indicator.above`, or `indicator.below` in user-visible output.
- Phase parallelism: plan depends only on existing `SemanticState` and codegen services, so Phase 3/4/5 can continue independently.
- Test-first flow: every task starts with a failing test and ends with targeted verification plus a small commit.
